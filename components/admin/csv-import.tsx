'use client';

import { useState, useCallback, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { SerializedProject } from '@/app/(app)/admin/actions';
import type { SerializedMasterclass } from '@/app/(app)/admin/import/actions';
import { getMasterclassesByProject } from '@/app/(app)/admin/import/actions';
import {
  UploadIcon,
  FileSpreadsheetIcon,
  XIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  LoaderIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields expected by the bulk import API (minus projectId/masterclassId). */
const LEAD_FIELDS = [
  'name',
  'email',
  'phone',
  'occupationType',
  'seniority',
  'city',
  'sourceChannel',
  'jobTitle',
] as const;
type LeadField = (typeof LEAD_FIELDS)[number];

/** Header aliases that auto-map to canonical fields. */
const HEADER_ALIASES: Record<string, LeadField> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  occupation: 'occupationType',
  occupationtype: 'occupationType',
  occupation_type: 'occupationType',
  seniority: 'seniority',
  city: 'city',
  source: 'sourceChannel',
  sourcechannel: 'sourceChannel',
  source_channel: 'sourceChannel',
  job_title: 'jobTitle',
  jobtitle: 'jobTitle',
};

const FIELD_LABELS: Record<LeadField, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  occupationType: 'Occupation Type',
  seniority: 'Seniority',
  city: 'City',
  sourceChannel: 'Source Channel',
  jobTitle: 'Job Title',
};

interface ImportError {
  row: number;
  error: string;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

// ---------------------------------------------------------------------------
// CSV Parser — handles quoted fields, commas in values, empty rows
// ---------------------------------------------------------------------------

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row: string[] = [];

    while (i < len) {
      let value = '';

      // Skip leading whitespace (not newlines)
      while (i < len && (text[i] === ' ' || text[i] === '\t')) i++;

      if (i < len && text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              // Escaped quote
              value += '"';
              i += 2;
            } else {
              // Closing quote
              i++; // skip closing quote
              break;
            }
          } else {
            value += text[i];
            i++;
          }
        }
        // Skip until comma or newline
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          i++;
        }
      } else {
        // Unquoted field
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          value += text[i];
          i++;
        }
        value = value.trimEnd();
      }

      row.push(value);

      if (i < len && text[i] === ',') {
        i++; // skip comma, continue to next field
      } else {
        break; // end of row
      }
    }

    // Skip newline characters
    while (i < len && (text[i] === '\n' || text[i] === '\r')) {
      i++;
    }

    // Skip truly empty rows (all empty fields)
    if (row.length > 0 && row.some((cell) => cell.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function autoMapHeaders(headers: string[]): (LeadField | null)[] {
  return headers.map((h) => {
    const normalized = h.trim().toLowerCase().replace(/\s+/g, '_');
    return HEADER_ALIASES[normalized] ?? null;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CsvImportProps {
  projects: SerializedProject[];
}

export function CsvImport({ projects }: CsvImportProps) {
  // Step tracking
  type Step = 'select' | 'upload' | 'preview' | 'importing' | 'done';
  const [step, setStep] = useState<Step>('select');

  // Project + Masterclass
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedMasterclassId, setSelectedMasterclassId] = useState<string>('');
  const [masterclasses, setMasterclasses] = useState<SerializedMasterclass[]>([]);
  const [loadingMasterclasses, startMcTransition] = useTransition();

  // CSV data
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<(LeadField | null)[]>([]);

  // Import state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Project selection ---
  const handleProjectChange = useCallback(
    (projectId: string | null) => {
      const id = projectId ?? '';
      setSelectedProjectId(id);
      setSelectedMasterclassId('');
      setMasterclasses([]);

      if (id) {
        startMcTransition(async () => {
          const mcs = await getMasterclassesByProject(id);
          setMasterclasses(mcs);
        });
      }
    },
    [],
  );

  // --- File handling ---
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportError('Please upload a .csv file');
      return;
    }
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length < 2) {
        setImportError('CSV must have at least a header row and one data row');
        return;
      }

      const csvHeaders = parsed[0] ?? [];
      const csvRows = parsed.slice(1);
      const mapping = autoMapHeaders(csvHeaders);

      setFileName(file.name);
      setHeaders(csvHeaders);
      setRows(csvRows);
      setColumnMapping(mapping);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleColumnMappingChange = useCallback(
    (colIndex: number, value: string | null) => {
      setColumnMapping((prev) => {
        const next = [...prev];
        next[colIndex] = !value || value === '__skip__' ? null : (value as LeadField);
        return next;
      });
    },
    [],
  );

  const resetFile = useCallback(() => {
    setFileName('');
    setHeaders([]);
    setRows([]);
    setColumnMapping([]);
    setImportResult(null);
    setImportError(null);
    setStep(selectedProjectId && selectedMasterclassId ? 'upload' : 'select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedProjectId, selectedMasterclassId]);

  // --- Import ---
  const handleImport = useCallback(async () => {
    if (!selectedProjectId || !selectedMasterclassId) return;

    // Build lead objects from mapped columns
    const leads: Record<string, string | boolean>[] = [];
    for (const row of rows) {
      const lead: Record<string, string | boolean> = {
        projectId: selectedProjectId,
        masterclassId: selectedMasterclassId,
      };

      for (let colIdx = 0; colIdx < columnMapping.length; colIdx++) {
        const field = columnMapping[colIdx];
        if (field && colIdx < row.length) {
          const cellValue = (row[colIdx] ?? '').trim();
          if (cellValue) {
            lead[field] = cellValue;
          }
        }
      }

      // Skip rows without required fields
      if (lead.name && lead.email && lead.phone) {
        // Default occupationType if missing
        if (!lead.occupationType) {
          lead.occupationType = 'other';
        }
        // Default sourceChannel if missing
        if (!lead.sourceChannel) {
          lead.sourceChannel = 'other';
        }
        // isExistingCustomer defaults to false
        lead.isExistingCustomer = false;

        leads.push(lead);
      }
    }

    if (leads.length === 0) {
      setImportError(
        'No valid rows found. Ensure name, email, and phone columns are mapped.',
      );
      return;
    }

    setStep('importing');
    setImportError(null);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error?.message ??
            errorData?.error ??
            `Import failed (${res.status})`,
        );
      }

      const result: ImportResult = await res.json();
      setImportResult(result);
      setStep('done');
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
      setStep('preview');
    }
  }, [rows, columnMapping, selectedProjectId, selectedMasterclassId]);

  // --- Validation helpers ---
  const hasRequiredMappings = (() => {
    const mapped = new Set(columnMapping.filter(Boolean));
    return mapped.has('name') && mapped.has('email') && mapped.has('phone');
  })();

  const canProceedToUpload = !!selectedProjectId && !!selectedMasterclassId;

  const previewRows = rows.slice(0, 10);

  const selectedProject = projects.find((p) => p._id === selectedProjectId);
  const selectedMasterclass = masterclasses.find(
    (m) => m._id === selectedMasterclassId,
  );

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* Project + Masterclass selection */}
      <div className="border border-stone-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              PROJECT
            </Label>
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger className="w-full text-[13px]">
                <SelectValue>
                  {selectedProject?.name ?? 'Select a project'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects
                  .filter((p) => p.active)
                  .map((project) => (
                    <SelectItem
                      key={project._id}
                      value={project._id}
                      className="text-[13px]"
                    >
                      {project.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              MASTERCLASS
            </Label>
            <Select
              value={selectedMasterclassId}
              onValueChange={(v: string | null) => {
                const mcId = v ?? '';
                setSelectedMasterclassId(mcId);
                if (step === 'select' && selectedProjectId && mcId) {
                  setStep('upload');
                }
              }}
              disabled={!selectedProjectId || loadingMasterclasses}
            >
              <SelectTrigger className="w-full text-[13px]">
                <SelectValue>
                  {selectedMasterclass?.title
                    ?? (loadingMasterclasses ? 'Loading...' : !selectedProjectId ? 'Select a project first' : 'Select a masterclass')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {masterclasses.map((mc) => (
                  <SelectItem
                    key={mc._id}
                    value={mc._id}
                    className="text-[13px]"
                  >
                    {mc.title}
                    <span className="ml-2 text-[11px] text-stone-400">
                      {new Date(mc.scheduledAt).toLocaleDateString()}
                    </span>
                  </SelectItem>
                ))}
                {masterclasses.length === 0 && !loadingMasterclasses && selectedProjectId && (
                  <div className="px-2 py-3 text-center text-[12px] text-stone-400">
                    No masterclasses found for this project.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      {canProceedToUpload && step !== 'done' && step !== 'importing' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => {
            if (step === 'upload') fileInputRef.current?.click();
          }}
          role={step === 'upload' ? 'button' : undefined}
          tabIndex={step === 'upload' ? 0 : undefined}
          onKeyDown={(e) => {
            if (step === 'upload' && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={
            step === 'upload'
              ? 'flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-stone-200 bg-stone-50 py-12 transition-colors hover:border-amber-600 hover:bg-amber-50/30'
              : 'border border-stone-200 bg-white p-3'
          }
        >
          {step === 'upload' ? (
            <>
              <UploadIcon className="size-8 text-stone-300" aria-hidden />
              <div className="text-center">
                <p className="text-[13px] font-medium text-stone-950">
                  Drag & drop your CSV file here
                </p>
                <p className="text-[11px] text-stone-500">
                  or click to browse. Expects columns: name, email, phone, occupation, seniority, city, source, job_title
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
                aria-label="Upload CSV file"
              />
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheetIcon
                  className="size-4 text-amber-700"
                  aria-hidden
                />
                <span className="text-[13px] font-medium text-stone-950">
                  {fileName}
                </span>
                <Badge
                  variant="secondary"
                  className="bg-stone-100 text-[10px] font-semibold uppercase tracking-widest text-stone-600"
                >
                  {rows.length} rows
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={resetFile}
                aria-label="Remove file"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input for preview/re-upload */}
      {step !== 'upload' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
          aria-label="Upload CSV file"
        />
      )}

      {/* Error message */}
      {importError && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-3">
          <AlertCircleIcon
            className="mt-0.5 size-4 shrink-0 text-red-800"
            aria-hidden
          />
          <p className="text-[12px] text-red-800">{importError}</p>
        </div>
      )}

      {/* Preview table + column mapping */}
      {step === 'preview' && previewRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-stone-950">
                Column Mapping
              </h2>
              <p className="text-[11px] text-stone-500">
                Confirm or adjust how CSV columns map to lead fields.
                {rows.length > 10 && ` Showing first 10 of ${rows.length} rows.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-500">
                Importing to:{' '}
                <span className="font-medium text-stone-950">
                  {selectedProject?.name}
                </span>
                {' / '}
                <span className="font-medium text-stone-950">
                  {selectedMasterclass?.title}
                </span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-stone-200 bg-white">
            <Table>
              <TableHeader>
                {/* Column mapping dropdowns row */}
                <TableRow className="border-stone-200 hover:bg-transparent">
                  {headers.map((header, colIdx) => (
                    <TableHead
                      key={colIdx}
                      className="min-w-[140px] p-1.5"
                    >
                      <div className="space-y-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                          {header}
                        </span>
                        <Select
                          value={columnMapping[colIdx] ?? '__skip__'}
                          onValueChange={(v) =>
                            handleColumnMappingChange(colIdx, v)
                          }
                        >
                          <SelectTrigger className="h-6 w-full text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value="__skip__"
                              className="text-[11px] text-stone-400"
                            >
                              Skip column
                            </SelectItem>
                            {LEAD_FIELDS.map((field) => (
                              <SelectItem
                                key={field}
                                value={field}
                                className="text-[11px]"
                              >
                                {FIELD_LABELS[field]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, rowIdx) => (
                  <TableRow key={rowIdx} className="border-stone-200">
                    {headers.map((_, colIdx) => (
                      <TableCell
                        key={colIdx}
                        className="text-[12px] text-stone-700"
                      >
                        {row[colIdx] ?? ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Validation status + Import button */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              {!hasRequiredMappings && (
                <p className="text-[11px] text-red-800">
                  Required: name, email, and phone columns must be mapped.
                </p>
              )}
              {hasRequiredMappings && (
                <p className="text-[11px] text-teal-700">
                  Ready to import {rows.length} lead{rows.length !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
            <Button
              onClick={handleImport}
              disabled={!hasRequiredMappings}
              className="bg-amber-700 text-white hover:bg-amber-800"
            >
              <UploadIcon data-icon="inline-start" className="size-3.5" />
              Import {rows.length} lead{rows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Importing state */}
      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center gap-3 border border-stone-200 bg-white py-12">
          <LoaderIcon
            className="size-6 animate-spin text-amber-700"
            aria-hidden
          />
          <p className="text-[13px] font-medium text-stone-950">
            Importing leads...
          </p>
          <p className="text-[11px] text-stone-500">
            Processing {rows.length} rows. This may take a moment.
          </p>
        </div>
      )}

      {/* Results */}
      {step === 'done' && importResult && (
        <div className="space-y-3">
          <div className="border border-stone-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2Icon
                className="mt-0.5 size-5 shrink-0 text-teal-700"
                aria-hidden
              />
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-stone-950">
                    Import Complete
                  </h2>
                  <p className="text-[12px] text-stone-500">
                    Processed {importResult.total} total rows.
                  </p>
                </div>

                <div className="flex gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      IMPORTED
                    </span>
                    <p className="font-mono text-[18px] font-medium text-teal-700">
                      {importResult.imported}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      SKIPPED
                    </span>
                    <p className="font-mono text-[18px] font-medium text-stone-400">
                      {importResult.skipped}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      ERRORS
                    </span>
                    <p className="font-mono text-[18px] font-medium text-red-800">
                      {importResult.errors.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error details */}
          {importResult.errors.length > 0 && (
            <div className="border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                  ERROR DETAILS
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-stone-200 hover:bg-transparent">
                      <TableHead className="w-16 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                        Row
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                        Error
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.errors.map((err, idx) => (
                      <TableRow key={idx} className="border-stone-200">
                        <TableCell className="font-mono text-[12px] text-stone-600">
                          {err.row}
                        </TableCell>
                        <TableCell className="text-[12px] text-red-800">
                          {err.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            onClick={resetFile}
            className="border-stone-200 text-stone-600 hover:bg-stone-100"
          >
            Import more leads
          </Button>
        </div>
      )}
    </div>
  );
}

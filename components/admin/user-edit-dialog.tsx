'use client';

import { useState, useTransition } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { updateUser } from '@/app/(app)/admin/actions';
import type { SerializedProject, SerializedUser } from '@/app/(app)/admin/actions';
import { PencilIcon, XIcon } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales_lead', label: 'Sales Lead' },
  { value: 'bda', label: 'BDA' },
] as const;

interface UserEditDialogProps {
  user: SerializedUser;
  projects: SerializedProject[];
}

export function UserEditDialog({ user, projects }: UserEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>(user.role);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    user.assignedProjectIds,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setRole(user.role);
    setSelectedProjectIds(user.assignedProjectIds);
    setError(null);
  }

  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  }

  function handleSubmit() {
    if (!role) {
      setError('Role is required');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await updateUser(user._id, {
        role,
        assignedProjectIds: role === 'admin' ? [] : selectedProjectIds,
      });

      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? 'Failed to update user');
      }
    });
  }

  const activeProjects = projects.filter((p) => p.active);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="text-[11px] text-stone-500 hover:text-stone-950"
          >
            <PencilIcon data-icon="inline-start" className="size-3" />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update role and project assignments for {user.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Name (read-only) */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              NAME
            </Label>
            <p className="text-[13px] text-stone-950">{user.name}</p>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              EMAIL
            </Label>
            <p className="text-[13px] text-stone-500">{user.email}</p>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              ROLE
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v ?? '')}>
              <SelectTrigger className="h-8 w-full text-[13px]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project assignment (hidden for admin) */}
          {role && role !== 'admin' && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                ASSIGNED PROJECTS
              </Label>
              {activeProjects.length === 0 ? (
                <p className="text-[11px] text-stone-400">
                  No active projects. Create a project first.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {/* Selected tags */}
                  {selectedProjectIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedProjectIds.map((id) => {
                        const project = projects.find((p) => p._id === id);
                        if (!project) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
                          >
                            {project.name}
                            <button
                              type="button"
                              onClick={() => toggleProject(id)}
                              className="text-amber-600 hover:text-amber-900"
                              disabled={isPending}
                              aria-label={`Remove ${project.name}`}
                            >
                              <XIcon className="size-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Project checkboxes */}
                  <div className="max-h-32 space-y-0.5 overflow-y-auto border border-stone-200 p-1.5">
                    {activeProjects.map((project) => {
                      const isSelected = selectedProjectIds.includes(project._id);
                      return (
                        <button
                          key={project._id}
                          type="button"
                          onClick={() => toggleProject(project._id)}
                          disabled={isPending}
                          className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] transition-colors ${
                            isSelected
                              ? 'bg-amber-50 text-amber-900'
                              : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <span
                            className={`flex size-3.5 shrink-0 items-center justify-center border ${
                              isSelected
                                ? 'border-amber-700 bg-amber-700 text-white'
                                : 'border-stone-300'
                            }`}
                          >
                            {isSelected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path
                                  d="M1 4L3.5 6.5L9 1"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="truncate">{project.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-stone-400">
                            {project.slug}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[11px] text-red-800">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !role}
            className="bg-amber-700 text-white hover:bg-amber-800"
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

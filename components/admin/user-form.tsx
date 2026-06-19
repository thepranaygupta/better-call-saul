'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { createUser } from '@/app/(app)/admin/actions';
import type { SerializedProject } from '@/app/(app)/admin/actions';
import { PlusIcon, XIcon } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales_lead', label: 'Sales Lead' },
  { value: 'bda', label: 'BDA' },
] as const;

interface UserFormProps {
  projects: SerializedProject[];
}

export function UserForm({ projects }: UserFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setRole('');
    setSelectedProjectIds([]);
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
    if (!name.trim() || !email.trim() || !password || !role) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        assignedProjectIds: role === 'admin' ? [] : selectedProjectIds,
      });

      if (result.success) {
        resetForm();
        setOpen(false);
      } else {
        setError(result.error ?? 'Failed to create user');
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
          <Button size="sm" className="bg-amber-700 text-white hover:bg-amber-800">
            <PlusIcon data-icon="inline-start" className="size-3.5" />
            Add user
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Add a new team member and assign them to projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Name */}
          <div className="space-y-1">
            <Label
              htmlFor="user-name"
              className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
            >
              NAME
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="h-8 text-[13px]"
              disabled={isPending}
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label
              htmlFor="user-email"
              className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
            >
              EMAIL
            </Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="h-8 text-[13px]"
              disabled={isPending}
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label
              htmlFor="user-password"
              className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
            >
              PASSWORD
            </Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="h-8 text-[13px]"
              disabled={isPending}
            />
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
                            className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
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
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                            isSelected
                              ? 'bg-amber-50 text-amber-900'
                              : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <span
                            className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border ${
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
            disabled={isPending || !name.trim() || !email.trim() || !password || !role}
            className="bg-amber-700 text-white hover:bg-amber-800"
          >
            {isPending ? 'Creating...' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

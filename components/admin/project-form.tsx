'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createProject } from '@/app/(app)/admin/actions';
import { PlusIcon } from 'lucide-react';

export function ProjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName('');
    setSlug('');
    setDescription('');
    setError(null);
  }

  function handleNameChange(value: string) {
    setName(value);
    // Auto-generate slug from name
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(autoSlug);
  }

  function handleSubmit() {
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createProject({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });

      if (result.success) {
        resetForm();
        setOpen(false);
      } else {
        setError(result.error ?? 'Failed to create project');
      }
    });
  }

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
            Add project
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Add a new brand or business group to the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label
              htmlFor="project-name"
              className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
            >
              NAME
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Be10X"
              className="h-8 text-[13px]"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="project-slug"
              className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
            >
              SLUG
            </Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. be10x"
              className="h-8 font-mono text-[13px]"
              disabled={isPending}
            />
            <p className="text-[10px] text-stone-400">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="project-description"
              className="text-[10px] font-semibold uppercase tracking-widest text-stone-500"
            >
              DESCRIPTION
            </Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="min-h-[60px] resize-none text-[13px]"
              maxLength={1000}
              disabled={isPending}
            />
          </div>

          {error && <p className="text-[11px] text-red-800">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !slug.trim()}
            className="bg-amber-700 text-white hover:bg-amber-800"
          >
            {isPending ? 'Creating...' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 border border-dashed border-stone-300 bg-stone-50 py-16 text-center',
        className,
      )}
    >
      <Inbox className="size-10 text-stone-300" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-stone-950">{title}</h3>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

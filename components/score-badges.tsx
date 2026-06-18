import { cn } from '@/lib/utils';

interface ScoreBadgesProps {
  fitScore: number;
  intentScore: number;
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-red-800';
  if (score >= 40) return 'text-amber-700';
  return 'text-stone-400';
}

export function ScoreBadges({ fitScore, intentScore, className }: ScoreBadgesProps) {
  return (
    <div className={cn('flex items-center gap-3 font-mono text-xs font-medium', className)}>
      <span className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-widest text-stone-500">F</span>
        <span className={scoreColor(fitScore)}>{String(fitScore).padStart(2, '0')}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-widest text-stone-500">I</span>
        <span className={scoreColor(intentScore)}>{String(intentScore).padStart(2, '0')}</span>
      </span>
    </div>
  );
}

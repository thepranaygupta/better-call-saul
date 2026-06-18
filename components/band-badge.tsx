import { cn } from '@/lib/utils';

export type Band = 'call_now' | 'qualify' | 'nurture' | 'cold' | 'disqualified';

const BAND_CONFIG: Record<Band, { label: string; color: string; textColor: string }> = {
  call_now: {
    label: 'CALL NOW',
    color: 'bg-red-800/10',
    textColor: 'text-red-800',
  },
  qualify: {
    label: 'QUALIFY',
    color: 'bg-amber-600/10',
    textColor: 'text-amber-600',
  },
  nurture: {
    label: 'NURTURE',
    color: 'bg-teal-700/10',
    textColor: 'text-teal-700',
  },
  cold: {
    label: 'COLD',
    color: 'bg-stone-400/10',
    textColor: 'text-stone-400',
  },
  disqualified: {
    label: 'DISQUALIFIED',
    color: 'bg-stone-300/10',
    textColor: 'text-stone-300',
  },
};

/** Band heat strip color for the 4px left border */
export const BAND_BORDER_COLORS: Record<Band, string> = {
  call_now: 'border-l-red-800',
  qualify: 'border-l-amber-600',
  nurture: 'border-l-teal-700',
  cold: 'border-l-stone-400',
  disqualified: 'border-l-stone-300',
};

interface BandBadgeProps {
  band: Band;
  className?: string;
}

export function BandBadge({ band, className }: BandBadgeProps) {
  const config = BAND_CONFIG[band];

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
        config.color,
        config.textColor,
        band === 'disqualified' && 'line-through',
        className,
      )}
    >
      {config.label}
    </span>
  );
}

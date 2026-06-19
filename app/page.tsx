import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saul — Better Call Your Hottest Lead First',
  description:
    'A fit x intent lead-prioritization console for edtech sales floors.',
};

const BAND_COLORS: Record<string, string> = {
  call_now: '#991B1B',
  qualify: '#D97706',
  nurture: '#0F766E',
  cold: '#A8A29E',
};

const DOTS: { fit: number; intent: number }[] = [
  { fit: 82, intent: 88 }, { fit: 91, intent: 76 }, { fit: 72, intent: 92 },
  { fit: 68, intent: 85 }, { fit: 88, intent: 94 }, { fit: 35, intent: 78 },
  { fit: 22, intent: 85 }, { fit: 45, intent: 72 }, { fit: 78, intent: 22 },
  { fit: 85, intent: 38 }, { fit: 65, intent: 25 }, { fit: 25, intent: 28 },
  { fit: 35, intent: 35 }, { fit: 42, intent: 18 }, { fit: 15, intent: 42 },
  { fit: 32, intent: 15 }, { fit: 48, intent: 25 }, { fit: 12, intent: 18 },
];

function getBand(fit: number, intent: number): string {
  if (fit >= 60 && intent >= 60) return 'call_now';
  if (intent >= 60) return 'qualify';
  if (fit >= 60) return 'nurture';
  return 'cold';
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ backgroundColor: '#F5F5F0' }}>
      <div className="flex w-full max-w-xs flex-col items-center gap-10">
        {/* Quadrant dot — visual signature */}
        <svg
          width={120}
          height={120}
          viewBox="0 0 120 120"
          className="shrink-0"
          aria-label="Fit vs Intent quadrant scatter plot"
          role="img"
        >
          <rect x={12} y={12} width={48} height={48} fill="rgba(217,119,6,0.06)" />
          <rect x={60} y={12} width={48} height={48} fill="rgba(153,27,27,0.06)" />
          <rect x={12} y={60} width={48} height={48} fill="rgba(168,162,158,0.04)" />
          <rect x={60} y={60} width={48} height={48} fill="rgba(15,118,110,0.06)" />
          <line x1={60} y1={12} x2={60} y2={108} stroke="#D97706" strokeWidth={0.5} strokeOpacity={0.3} />
          <line x1={12} y1={60} x2={108} y2={60} stroke="#D97706" strokeWidth={0.5} strokeOpacity={0.3} />
          <rect x={12} y={12} width={96} height={96} fill="none" stroke="#E7E5E4" strokeWidth={1} />
          {DOTS.map((d, i) => {
            const band = getBand(d.fit, d.intent);
            return (
              <circle
                key={i}
                cx={12 + (d.fit / 100) * 96}
                cy={108 - (d.intent / 100) * 96}
                r={band === 'call_now' ? 4 : 3}
                fill={BAND_COLORS[band]}
                opacity={band === 'call_now' ? 0.9 : 0.6}
              />
            );
          })}
        </svg>

        {/* Name + tagline */}
        <div className="text-center">
          <h1 className="text-[20px] font-semibold tracking-tight text-stone-950">
            Saul
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
            Better call your hottest lead first.
          </p>
        </div>

        {/* Sign in */}
        <Link
          href="/login"
          className="inline-block w-full bg-amber-700 px-5 py-2.5 text-center text-[13px] font-medium text-white transition-colors hover:bg-amber-800"
        >
          Sign in
        </Link>

        {/* Footer */}
        <footer className="flex items-center gap-2 text-[11px] text-stone-400">
          <span>Pranay Gupta</span>
          <span className="text-stone-300">&middot;</span>
          <a
            href="https://github.com/thepranaygupta"
            className="hover:text-stone-600 transition-colors"
          >
            GitHub
          </a>
          <span className="text-stone-300">&middot;</span>
          <a
            href="https://linkedin.com/in/thepranaygupta"
            className="hover:text-stone-600 transition-colors"
          >
            LinkedIn
          </a>
        </footer>
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saul — Better Call Your Hottest Lead First',
  description:
    'A fit x intent lead-prioritization console for edtech sales floors.',
};

const BAND_META = {
  call_now: { color: '#991B1B', label: 'Call Now' },
  qualify: { color: '#D97706', label: 'Qualify' },
  nurture: { color: '#0F766E', label: 'Nurture' },
  cold: { color: '#A8A29E', label: 'Cold' },
} as const;

type Band = keyof typeof BAND_META;

const DOTS: { fit: number; intent: number }[] = [
  { fit: 82, intent: 88 }, { fit: 91, intent: 76 }, { fit: 72, intent: 92 },
  { fit: 68, intent: 85 }, { fit: 88, intent: 94 }, { fit: 76, intent: 71 },
  { fit: 35, intent: 78 }, { fit: 22, intent: 85 }, { fit: 45, intent: 72 },
  { fit: 28, intent: 68 },
  { fit: 78, intent: 22 }, { fit: 85, intent: 38 }, { fit: 65, intent: 25 },
  { fit: 72, intent: 42 },
  { fit: 25, intent: 28 }, { fit: 35, intent: 35 }, { fit: 42, intent: 18 },
  { fit: 15, intent: 42 }, { fit: 32, intent: 15 }, { fit: 12, intent: 18 },
  { fit: 48, intent: 25 },
];

function getBand(fit: number, intent: number): Band {
  if (fit >= 60 && intent >= 60) return 'call_now';
  if (intent >= 60) return 'qualify';
  if (fit >= 60) return 'nurture';
  return 'cold';
}


const PIPELINE_STEPS = [
  { label: 'Register', desc: 'Lead signs up for a free masterclass' },
  { label: 'Attend', desc: 'Watch live or replay; chat, ask questions, click offers' },
  { label: 'Score', desc: 'Fit x intent scored from profile + behavior + AI-extracted signals' },
  { label: 'Queue', desc: 'BDA opens their ranked list, calls the top lead first' },
];

const TECH = [
  'Next.js 16', 'React 19', 'TypeScript', 'Tailwind v4', 'shadcn/ui',
  'MongoDB', 'Auth.js v5', 'Vercel AI SDK', 'Zod', 'Vitest',
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
      {children}
    </p>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 py-12 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col items-center gap-16 sm:gap-20">

        {/* Brand + pitch + sign-in */}
        <div className="flex flex-col items-center gap-8 pt-4 sm:pt-8">
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold tracking-[0.35em] text-foreground sm:text-xl">
              S A U L
            </h1>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:text-[11px]">
              Better Call Your Hottest Lead First
            </p>
            <div className="mt-2.5 h-[2px] w-8 bg-amber-600" />
          </div>

          <p className="max-w-md text-center text-sm leading-relaxed text-muted-foreground">
            A lead-prioritization console for edtech sales floors. Saul scores
            masterclass registrants on two axes, extracts buying signals from
            live chat, and gives BDAs a ranked queue with explainable scores
            and AI call prep.
          </p>

          <Link
            href="/login"
            className="inline-flex h-10 w-full max-w-xs items-center justify-center bg-amber-700 text-sm font-medium text-white transition-colors hover:bg-amber-800"
          >
            Sign in
          </Link>
        </div>

        {/* Two axes, not one */}
        <div className="flex w-full flex-col items-center gap-6">
          <SectionLabel>Two axes, not one</SectionLabel>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
            <svg
              width={220}
              height={220}
              viewBox="0 0 240 240"
              className="shrink-0"
              aria-label="Fit versus Intent quadrant: leads plotted on two axes"
              role="img"
            >
              <rect x={20} y={20} width={100} height={100} fill="rgba(217,119,6,0.04)" />
              <rect x={120} y={20} width={100} height={100} fill="rgba(153,27,27,0.05)" />
              <rect x={20} y={120} width={100} height={100} fill="rgba(168,162,158,0.04)" />
              <rect x={120} y={120} width={100} height={100} fill="rgba(15,118,110,0.04)" />

              <line x1={120} y1={20} x2={120} y2={220} stroke="#D6D3D1" strokeWidth={0.75} strokeDasharray="3,3" />
              <line x1={20} y1={120} x2={220} y2={120} stroke="#D6D3D1" strokeWidth={0.75} strokeDasharray="3,3" />
              <rect x={20} y={20} width={200} height={200} fill="none" stroke="#E7E5E4" strokeWidth={1} />

              <text x={120} y={238} textAnchor="middle" fill="#A8A29E" fontSize={9} fontFamily="system-ui, sans-serif">Fit</text>
              <text x={8} y={120} textAnchor="middle" fill="#A8A29E" fontSize={9} fontFamily="system-ui, sans-serif" transform="rotate(-90, 8, 120)">Intent</text>

              <text x={170} y={38} textAnchor="middle" fill="#991B1B" fontSize={8} fontFamily="system-ui, sans-serif" opacity={0.45}>Call Now</text>
              <text x={70} y={38} textAnchor="middle" fill="#D97706" fontSize={8} fontFamily="system-ui, sans-serif" opacity={0.4}>Qualify</text>
              <text x={170} y={212} textAnchor="middle" fill="#0F766E" fontSize={8} fontFamily="system-ui, sans-serif" opacity={0.4}>Nurture</text>
              <text x={70} y={212} textAnchor="middle" fill="#A8A29E" fontSize={8} fontFamily="system-ui, sans-serif" opacity={0.4}>Cold</text>

              {DOTS.map((d, i) => {
                const band = getBand(d.fit, d.intent);
                const meta = BAND_META[band];
                return (
                  <circle
                    key={i}
                    cx={20 + (d.fit / 100) * 200}
                    cy={220 - (d.intent / 100) * 200}
                    r={band === 'call_now' ? 5 : 3.5}
                    fill={meta.color}
                    opacity={band === 'call_now' ? 0.85 : band === 'qualify' ? 0.7 : 0.45}
                  />
                );
              })}
            </svg>

            <div className="flex flex-col gap-3.5">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Fit</span> tells you who.{' '}
                <span className="font-medium text-foreground">Intent</span> tells you when.
              </p>
              {Object.entries(BAND_META).map(([key, { color, label }]) => (
                <div key={key} className="flex items-start gap-2.5">
                  <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <p className="text-xs text-muted-foreground">
                      {key === 'call_now' && 'High fit, high intent. Call these first.'}
                      {key === 'qualify' && 'Interested but uncertain fit. Worth a conversation.'}
                      {key === 'nurture' && 'Good profile, low engagement. Follow up later.'}
                      {key === 'cold' && 'Low on both. Deprioritize.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <div className="flex w-full flex-col items-center gap-6">
          <SectionLabel>How a lead moves through Saul</SectionLabel>

          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-stone-300">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{step.label}</span>
                </div>
                <p className="pl-5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI layer */}
        <div className="flex w-full flex-col items-center gap-4">
          <SectionLabel>The AI layer</SectionLabel>

          <div className="max-w-lg space-y-3 text-center text-sm leading-relaxed text-muted-foreground">
            <p>
              An LLM reads chat messages and Q&A transcripts, then extracts structured
              buying signals: <em>asked about EMI</em>, <em>price objection</em>,
              {' '}<em>career switch intent</em>. These feed into the scoring engine as
              weighted inputs alongside behavioral events.
            </p>
            <p>
              The model never decides the score or priority. It classifies; the rules engine scores.
              If AI is unavailable, the queue still works on structured activity data alone.
            </p>
          </div>
        </div>

        {/* Built with */}
        <div className="flex w-full flex-col items-center gap-4">
          <SectionLabel>Built with</SectionLabel>
          <p className="text-center text-xs text-muted-foreground">
            {TECH.join(' · ')}
          </p>
        </div>

        {/* Footer */}
        <footer className="flex items-center gap-2 pb-4 text-[11px] text-muted-foreground">
          <span>Pranay Gupta</span>
          <span className="text-stone-300">&middot;</span>
          <a href="https://github.com/thepranaygupta" className="transition-colors hover:text-foreground">
            GitHub
          </a>
          <span className="text-stone-300">&middot;</span>
          <a href="https://linkedin.com/in/thepranaygupta" className="transition-colors hover:text-foreground">
            LinkedIn
          </a>
        </footer>
      </div>
    </div>
  );
}

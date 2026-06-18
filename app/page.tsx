import Link from 'next/link';
import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';

const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Saul — Better Call Your Hottest Lead First',
  description:
    'A fit × intent lead-prioritization console for edtech sales floors. Explainable scoring, LLM signal extraction, calibrated bands.',
};

const THRESHOLD = 60;

const DOTS: { fit: number; intent: number }[] = [
  { fit: 72, intent: 88 },
  { fit: 85, intent: 76 },
  { fit: 68, intent: 82 },
  { fit: 78, intent: 91 },
  { fit: 91, intent: 85 },
  { fit: 75, intent: 78 },
  { fit: 82, intent: 94 },
  { fit: 88, intent: 72 },
  { fit: 35, intent: 78 },
  { fit: 22, intent: 85 },
  { fit: 45, intent: 72 },
  { fit: 28, intent: 91 },
  { fit: 38, intent: 82 },
  { fit: 15, intent: 76 },
  { fit: 72, intent: 35 },
  { fit: 85, intent: 28 },
  { fit: 68, intent: 42 },
  { fit: 78, intent: 22 },
  { fit: 91, intent: 38 },
  { fit: 75, intent: 15 },
  { fit: 82, intent: 45 },
  { fit: 88, intent: 32 },
  { fit: 65, intent: 25 },
  { fit: 70, intent: 48 },
  { fit: 25, intent: 28 },
  { fit: 35, intent: 35 },
  { fit: 15, intent: 42 },
  { fit: 42, intent: 18 },
  { fit: 28, intent: 22 },
  { fit: 38, intent: 45 },
  { fit: 18, intent: 32 },
  { fit: 45, intent: 38 },
  { fit: 32, intent: 15 },
  { fit: 22, intent: 48 },
  { fit: 48, intent: 25 },
  { fit: 12, intent: 18 },
  { fit: 35, intent: 10 },
  { fit: 40, intent: 30 },
  { fit: 20, intent: 38 },
];

function getBand(fit: number, intent: number): string {
  if (fit >= THRESHOLD && intent >= THRESHOLD) return 'call_now';
  if (intent >= THRESHOLD) return 'qualify';
  if (fit >= THRESHOLD) return 'nurture';
  return 'cold';
}

const BAND_COLORS: Record<string, string> = {
  call_now: '#fbbf24',
  qualify: '#a78bfa',
  nurture: '#60a5fa',
  cold: '#52525b',
};

const FIT_SIGNALS = [
  { signal: 'working_professional', points: 25 },
  { signal: 'senior · product_manager', points: 18 },
  { signal: 'referral', points: 15 },
  { signal: 'returning_customer', points: 12 },
  { signal: 'metro_city · IST', points: 8 },
];

const INTENT_SIGNALS: { signal: string; points: number; evidence?: string }[] = [
  { signal: 'attended_live', points: 22 },
  { signal: '92% watch (past pitch)', points: 20 },
  { signal: 'asked_emi', points: 15, evidence: '"is there an EMI option?"' },
  { signal: 'clicked_offer', points: 14 },
  {
    signal: 'high_enthusiasm',
    points: 12,
    evidence: '"this is exactly what I needed"',
  },
  { signal: 'poll: interested', points: 7 },
  { signal: 'time_decay (3d)', points: -6 },
];

export default function LandingPage() {
  return (
    <div
      className={`${mono.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-500/20`}
    >
      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-mono text-xs tracking-[0.25em] text-zinc-500 uppercase">
            saul
          </span>
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            log in &rarr;
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extralight tracking-tight leading-[1.05]">
            better call
            <br />
            <span className="text-amber-400 font-normal">saul.</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-zinc-400 leading-relaxed max-w-xl">
            The ranked queue your sales floor opens every morning. Saul scores
            leads on two axes&thinsp;&mdash;&thinsp;fit and intent&thinsp;&mdash;&thinsp;not
            one blunt number. An LLM extracts buying signals from chat. A pure
            scoring engine does the math. You see every point.
          </p>
          <p className="mt-4 text-sm text-zinc-600 font-mono">
            Built as a hiring assignment. Not a product pitch.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 items-center">
            <Link
              href="/login"
              className="bg-amber-500 text-zinc-950 px-5 py-2.5 rounded-md text-sm font-medium hover:bg-amber-400 transition-colors"
            >
              log in with demo
            </Link>
            <a
              href="#how"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              how it works &darr;
            </a>
          </div>
        </div>
      </section>

      {/* ── One number isn't enough ────────────────────────────── */}
      <section id="how" className="py-20 md:py-28 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-[1fr,1.3fr] gap-12 md:gap-16 items-start">
            <div>
              <h2 className="text-2xl md:text-3xl font-light tracking-tight">
                one number isn&rsquo;t enough
              </h2>
              <p className="mt-5 text-zinc-400 leading-relaxed">
                A classic CRM sums all activity into one score. That conflates a
                senior PM who registered but ghosted with a student who watched
                the entire session and asked about EMI plans.
              </p>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Saul scores on two axes.{' '}
                <span className="text-teal-400">Fit</span> measures who they
                are. <span className="text-amber-400">Intent</span> measures
                what they&rsquo;ve done. The quadrant decides the action.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2.5">
                {(
                  [
                    ['call_now', 'call now'],
                    ['qualify', 'qualify'],
                    ['nurture', 'nurture'],
                    ['cold', 'cold'],
                  ] as const
                ).map(([band, label]) => (
                  <div key={band} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: BAND_COLORS[band] }}
                    />
                    <span className="text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quadrant scatter */}
            <div className="w-full">
              <svg
                viewBox="0 0 500 500"
                className="w-full"
                role="img"
                aria-label="Fit vs Intent quadrant scatter plot"
              >
                <title>Lead distribution across fit × intent quadrants</title>
                <rect
                  x="290"
                  y="50"
                  width="160"
                  height="160"
                  fill="rgba(251,191,36,0.04)"
                />
                <rect
                  x="50"
                  y="50"
                  width="240"
                  height="160"
                  fill="rgba(167,139,250,0.025)"
                />
                <rect
                  x="290"
                  y="210"
                  width="160"
                  height="240"
                  fill="rgba(96,165,250,0.025)"
                />

                {[20, 40, 60, 80].map((v) => {
                  const pos = 50 + (v / 100) * 400;
                  return (
                    <g key={v}>
                      <line
                        x1={pos}
                        y1={50}
                        x2={pos}
                        y2={450}
                        stroke="#27272a"
                        strokeWidth="0.5"
                      />
                      <line
                        x1={50}
                        y1={pos}
                        x2={450}
                        y2={pos}
                        stroke="#27272a"
                        strokeWidth="0.5"
                      />
                    </g>
                  );
                })}

                <line
                  x1={290}
                  y1={50}
                  x2={290}
                  y2={450}
                  stroke="#3f3f46"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                />
                <line
                  x1={50}
                  y1={210}
                  x2={450}
                  y2={210}
                  stroke="#3f3f46"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                />

                <rect
                  x={50}
                  y={50}
                  width={400}
                  height={400}
                  fill="none"
                  stroke="#27272a"
                />

                <text
                  x={370}
                  y={85}
                  fontSize="10"
                  fill="#fbbf24"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  opacity="0.5"
                >
                  call now
                </text>
                <text
                  x={160}
                  y={85}
                  fontSize="10"
                  fill="#a78bfa"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  opacity="0.5"
                >
                  qualify
                </text>
                <text
                  x={370}
                  y={435}
                  fontSize="10"
                  fill="#60a5fa"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  opacity="0.5"
                >
                  nurture
                </text>
                <text
                  x={160}
                  y={435}
                  fontSize="10"
                  fill="#52525b"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  opacity="0.5"
                >
                  cold
                </text>

                <text
                  x={250}
                  y={485}
                  fontSize="10"
                  fill="#52525b"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  fit &rarr;
                </text>
                <text
                  fontSize="10"
                  fill="#52525b"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  transform="rotate(-90 20 250)"
                >
                  intent &rarr;
                </text>

                {DOTS.map((d, i) => {
                  const band = getBand(d.fit, d.intent);
                  return (
                    <circle
                      key={i}
                      cx={50 + (d.fit / 100) * 400}
                      cy={450 - (d.intent / 100) * 400}
                      r={band === 'call_now' ? 6 : 5}
                      fill={BAND_COLORS[band]}
                      opacity={band === 'call_now' ? 0.9 : 0.7}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Every point, explained ─────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-light tracking-tight">
            every point, explained
          </h2>
          <p className="mt-5 text-zinc-400 leading-relaxed max-w-xl">
            No black boxes. Every score ships with its full breakdown&thinsp;&mdash;&thinsp;which
            signal fired, its category, its weight, how many points it added or
            subtracted. The UI renders this directly.
          </p>

          <div className="mt-12 bg-zinc-900/80 border border-white/[0.06] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/[0.04] flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-100">Priya Sharma</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Senior PM &middot; Flipkart &middot; Mumbai
                </p>
              </div>
              <span className="shrink-0 text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15">
                call now
              </span>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Fit axis */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-teal-400 tracking-wider uppercase">
                    Fit
                  </span>
                  <span className="text-sm font-mono text-zinc-300">78</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-teal-500/70 rounded-full"
                    style={{ width: '78%' }}
                  />
                </div>
                <div className="space-y-1.5">
                  {FIT_SIGNALS.map((s) => (
                    <div
                      key={s.signal}
                      className="flex justify-between font-mono text-sm"
                    >
                      <span className="text-zinc-400">{s.signal}</span>
                      <span className="text-emerald-400/80">+{s.points}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.04]" />

              {/* Intent axis */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-amber-400 tracking-wider uppercase">
                    Intent
                  </span>
                  <span className="text-sm font-mono text-zinc-300">84</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-amber-500/70 rounded-full"
                    style={{ width: '84%' }}
                  />
                </div>
                <div className="space-y-1.5">
                  {INTENT_SIGNALS.map((s) => (
                    <div key={s.signal}>
                      <div className="flex justify-between font-mono text-sm">
                        <span className="text-zinc-400">{s.signal}</span>
                        <span
                          className={
                            s.points > 0
                              ? 'text-emerald-400/80'
                              : 'text-red-400/80'
                          }
                        >
                          {s.points > 0 ? '+' : ''}
                          {s.points}
                        </span>
                      </div>
                      {s.evidence && (
                        <p className="mt-0.5 ml-4 text-xs text-zinc-600 italic">
                          &lsaquo; {s.evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The LLM knows its place ────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-light tracking-tight">
            the llm knows its place
          </h2>
          <p className="mt-5 text-zinc-400 leading-relaxed max-w-xl">
            The model extracts and generates. It never scores, ranks, or gates.
            If the API key is missing, everything still works&thinsp;&mdash;&thinsp;AI
            panels show &ldquo;unavailable&rdquo; with a retry, not a crash.
          </p>

          <div className="mt-12 grid sm:grid-cols-2 gap-10">
            <div>
              <p className="text-xs font-mono text-emerald-400/80 tracking-wider uppercase mb-5">
                It does
              </p>
              <ul className="space-y-3">
                {[
                  'extract buying signals from chat',
                  'write call-prep briefs',
                  'draft outreach messages',
                  'parse English, Hindi + Hinglish',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm text-zinc-300"
                  >
                    <span className="text-emerald-400/60 shrink-0">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-mono text-red-400/80 tracking-wider uppercase mb-5">
                It doesn&rsquo;t
              </p>
              <ul className="space-y-3">
                {[
                  'decide the score or priority',
                  'rank the queue',
                  'gate any core feature',
                  'touch the database directly',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm text-zinc-300"
                  >
                    <span className="text-red-400/60 shrink-0">&#10005;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Under the hood ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-light tracking-tight">
            under the hood
          </h2>
          <p className="mt-6 font-mono text-sm text-zinc-500 leading-loose">
            Next.js&nbsp;16 &middot; React&nbsp;19 &middot; TypeScript&nbsp;strict
            &middot; Tailwind&nbsp;v4 &middot; shadcn/ui &middot; MongoDB
            &middot; Mongoose &middot; Zod &middot; Auth.js&nbsp;v5 &middot;
            Vercel&nbsp;AI&nbsp;SDK &middot; Gemini&nbsp;Flash &middot;
            Upstash&nbsp;Redis &middot; Recharts &middot; Vitest &middot;
            Playwright &middot; GitHub&nbsp;Actions &middot; Vercel
          </p>
        </div>
      </section>

      {/* ── See for yourself ───────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-light tracking-tight">
            see for yourself
          </h2>
          <p className="mt-5 text-zinc-400 leading-relaxed">
            Log in with a demo account. BDAs are scoped to different
            projects&thinsp;&mdash;&thinsp;try both to see the access boundary.
          </p>

          <div className="mt-10 bg-zinc-900/80 border border-white/[0.06] rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-3 font-mono text-[11px] text-zinc-600 font-normal tracking-wider uppercase">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 font-mono text-[11px] text-zinc-600 font-normal tracking-wider uppercase">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 font-mono text-[11px] text-zinc-600 font-normal tracking-wider uppercase">
                    Password
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  {
                    role: 'admin',
                    email: 'admin@saul.demo',
                    pw: 'admin123',
                  },
                  {
                    role: 'sales lead',
                    email: 'lead@saul.demo',
                    pw: 'lead123',
                  },
                  {
                    role: 'bda · be10x',
                    email: 'bda1@saul.demo',
                    pw: 'bda123',
                  },
                  {
                    role: 'bda · office master',
                    email: 'bda2@saul.demo',
                    pw: 'bda123',
                  },
                ].map((u) => (
                  <tr
                    key={u.email}
                    className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-zinc-400">{u.role}</td>
                    <td className="px-5 py-3 text-zinc-300">{u.email}</td>
                    <td className="px-5 py-3 text-zinc-500">{u.pw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <Link
              href="/login"
              className="inline-block bg-amber-500 text-zinc-950 px-6 py-3 rounded-md text-sm font-medium hover:bg-amber-400 transition-colors"
            >
              log in &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <span className="font-mono text-xs tracking-[0.25em] text-zinc-700 uppercase">
            saul
          </span>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">Pranay Gupta</span>
            <span className="text-zinc-800">&middot;</span>
            <a
              href="https://github.com/thepranaygupta"
              className="hover:text-zinc-400 transition-colors"
            >
              GitHub
            </a>
            <span className="text-zinc-800">&middot;</span>
            <a
              href="https://linkedin.com/in/thepranaygupta"
              className="hover:text-zinc-400 transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

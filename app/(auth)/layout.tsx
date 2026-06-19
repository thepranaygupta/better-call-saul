const DOTS = [
  { fit: 82, intent: 88 }, { fit: 91, intent: 76 }, { fit: 72, intent: 92 },
  { fit: 68, intent: 85 }, { fit: 88, intent: 94 }, { fit: 76, intent: 71 },
  { fit: 35, intent: 78 }, { fit: 22, intent: 85 }, { fit: 45, intent: 72 },
  { fit: 78, intent: 22 }, { fit: 85, intent: 38 }, { fit: 65, intent: 25 },
  { fit: 25, intent: 28 }, { fit: 35, intent: 35 }, { fit: 42, intent: 18 },
  { fit: 15, intent: 42 }, { fit: 32, intent: 15 }, { fit: 48, intent: 25 },
];

const BAND_COLORS: Record<string, string> = {
  call_now: '#991B1B',
  qualify: '#D97706',
  nurture: '#0F766E',
  cold: '#A8A29E',
};

function getBand(fit: number, intent: number): string {
  if (fit >= 60 && intent >= 60) return 'call_now';
  if (intent >= 60) return 'qualify';
  if (fit >= 60) return 'nurture';
  return 'cold';
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden lg:flex lg:w-[45%] flex-col items-center justify-center overflow-hidden bg-stone-200/60 p-10">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold tracking-[0.35em] text-stone-900">
              S A U L
            </h1>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-stone-400">
              Better call your hottest lead first
            </p>
            <div className="mt-2.5 h-[2px] w-8 bg-amber-600" />
          </div>

          <svg
            width={260}
            height={230}
            viewBox="-40 -5 240 210"
            aria-hidden="true"
          >
            <rect x={0} y={0} width={100} height={100} fill="rgba(217,119,6,0.06)" />
            <rect x={100} y={0} width={100} height={100} fill="rgba(153,27,27,0.06)" />
            <rect x={0} y={100} width={100} height={100} fill="rgba(168,162,158,0.05)" />
            <rect x={100} y={100} width={100} height={100} fill="rgba(15,118,110,0.05)" />
            <line x1={100} y1={0} x2={100} y2={200} stroke="#C8C4BF" strokeWidth={0.75} strokeDasharray="3,3" />
            <line x1={0} y1={100} x2={200} y2={100} stroke="#C8C4BF" strokeWidth={0.75} strokeDasharray="3,3" />
            <rect x={0} y={0} width={200} height={200} fill="none" stroke="#C8C4BF" strokeWidth={1} />
            <text x={100} y={196} textAnchor="middle" fill="#78716C" fontSize={11} fontWeight={500} fontFamily="system-ui, sans-serif">Fit →</text>
            <text x={-12} y={100} textAnchor="middle" fill="#78716C" fontSize={11} fontWeight={500} fontFamily="system-ui, sans-serif" transform="rotate(-90, -12, 100)">Intent →</text>
            {DOTS.map((d, i) => {
              const band = getBand(d.fit, d.intent);
              return (
                <circle
                  key={i}
                  cx={(d.fit / 100) * 200}
                  cy={200 - (d.intent / 100) * 200}
                  r={band === 'call_now' ? 5 : 3.5}
                  fill={BAND_COLORS[band]}
                  opacity={band === 'call_now' ? 0.85 : band === 'qualify' ? 0.65 : 0.4}
                />
              );
            })}
          </svg>

          <p className="max-w-[240px] text-center text-[11px] leading-relaxed text-stone-400">
            Every lead scored on two axes. Top-right gets the first call.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="mb-10 lg:hidden">
            <span className="text-lg font-bold tracking-[0.3em] text-stone-950">
              S A U L
            </span>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
              Better call your hottest lead first
            </p>
            <div className="mt-2 h-[2px] w-7 rounded-full bg-amber-600" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

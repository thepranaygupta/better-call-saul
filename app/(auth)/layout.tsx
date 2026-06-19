export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-end overflow-hidden bg-[#0C0F1D] p-12 pb-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="pointer-events-none absolute top-[20%] right-[20%] h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-[30%] left-[10%] h-[300px] w-[300px] rounded-full bg-orange-600/5 blur-[100px]" />

        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-[0.35em] text-white">
            S A U L
          </h1>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.25em] text-stone-400">
            Better call your hottest lead first
          </p>
          <div className="mt-3 h-[3px] w-10 rounded-full bg-amber-500" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-stone-50 px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 lg:hidden">
            <span className="text-lg font-bold tracking-[0.3em] text-stone-950">
              S A U L
            </span>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
              Better call your hottest lead first
            </p>
            <div className="mt-2 h-[2px] w-7 rounded-full bg-amber-500" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function QueueLoading() {
  return (
    <div className="space-y-3">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-12 animate-pulse bg-stone-200" />
          <div className="h-7 w-36 animate-pulse bg-stone-200" />
        </div>
        <div className="h-3 w-16 animate-pulse bg-stone-200" />
      </div>

      {/* Header skeleton */}
      <div className="hidden md:block">
        <div className="flex h-8 items-center gap-3 border-b border-stone-200 px-3">
          <div className="h-2.5 w-12 animate-pulse bg-stone-200" />
          <div className="flex-1" />
          <div className="h-2.5 w-10 animate-pulse bg-stone-200" />
          <div className="h-2.5 w-10 animate-pulse bg-stone-200" />
          <div className="h-2.5 w-14 animate-pulse bg-stone-200" />
          <div className="h-2.5 w-16 animate-pulse bg-stone-200" />
        </div>
      </div>

      {/* Row skeletons — 12 rows to fill viewport */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[52px] items-center border-b border-stone-200 border-l-4 border-l-stone-200 px-3"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <div
              className="h-3 animate-pulse bg-stone-200"
              style={{ width: `${100 + (i % 3) * 40}px` }}
            />
            <div
              className="h-2.5 animate-pulse bg-stone-100"
              style={{ width: `${140 + (i % 4) * 20}px` }}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-4 w-14 animate-pulse bg-stone-200" />
            <div className="h-3 w-10 animate-pulse bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

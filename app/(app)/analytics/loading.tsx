export default function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      {/* Title skeleton */}
      <div className="space-y-1">
        <div className="h-6 w-28 animate-pulse bg-stone-200" />
        <div className="h-4 w-64 animate-pulse bg-stone-200" />
      </div>

      {/* Filters skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-40 animate-pulse bg-stone-200" />
        <div className="h-8 w-40 animate-pulse bg-stone-200" />
      </div>

      {/* Funnel chart skeleton */}
      <div className="space-y-2 border border-stone-200 p-4">
        <div className="h-3 w-20 animate-pulse bg-stone-200" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 animate-pulse bg-stone-200" />
              <div className="h-3 w-12 animate-pulse bg-stone-200" />
            </div>
            <div
              className="h-8 animate-pulse bg-stone-200"
              style={{ width: `${100 - i * 20}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

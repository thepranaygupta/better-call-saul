export default function AdminLoading() {
  return (
    <div className="space-y-4">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded-md bg-stone-200" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-stone-200" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b border-stone-200 pb-2">
        <div className="h-5 w-24 animate-pulse rounded bg-stone-200" />
        <div className="h-5 w-20 animate-pulse rounded bg-stone-200" />
      </div>

      {/* Table skeleton */}
      <div className="space-y-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
        {/* Header */}
        <div className="flex gap-4 border-b border-stone-200 px-4 py-3">
          <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-16 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-16 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
        </div>

        {/* Rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-stone-100 px-4 py-3 last:border-0"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="h-4 w-28 animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-14 animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

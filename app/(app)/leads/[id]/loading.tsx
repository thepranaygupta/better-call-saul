export default function LeadDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="border border-stone-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-48 animate-pulse bg-stone-200" />
              <div className="h-5 w-20 animate-pulse bg-stone-100" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-40 animate-pulse bg-stone-100" />
              <div className="h-3 w-28 animate-pulse bg-stone-100" />
            </div>
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 w-14 animate-pulse bg-stone-100" />
                <div className="h-3 w-20 animate-pulse bg-stone-200" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Score breakdown skeleton */}
          <div className="border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="h-2.5 w-28 animate-pulse bg-stone-200" />
            </div>
            <div className="p-4">
              <div className="flex items-start gap-4">
                {/* Quadrant dot placeholder */}
                <div className="size-[120px] shrink-0 animate-pulse bg-stone-100" />
                <div className="flex flex-1 flex-col gap-3">
                  <div className="h-5 w-20 animate-pulse bg-stone-100" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-14 animate-pulse bg-stone-100" />
                      <div className="h-2 flex-1 animate-pulse bg-stone-100" />
                      <div className="h-3 w-8 animate-pulse bg-stone-200" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-14 animate-pulse bg-stone-100" />
                      <div className="h-2 flex-1 animate-pulse bg-stone-100" />
                      <div className="h-3 w-8 animate-pulse bg-stone-200" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Contributions skeleton */}
              <div className="mt-4 border-t border-stone-100 pt-3">
                <div className="h-2.5 w-32 animate-pulse bg-stone-200" />
                <div className="mt-2 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="h-3 animate-pulse bg-stone-100"
                        style={{ width: `${80 + (i % 3) * 30}px` }}
                      />
                      <div className="h-3 w-10 animate-pulse bg-stone-100" />
                      <div className="ml-auto h-3 w-8 animate-pulse bg-stone-100" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI brief placeholder skeleton */}
          <div className="border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="h-2.5 w-24 animate-pulse bg-stone-200" />
            </div>
            <div className="p-4">
              <div className="h-20 animate-pulse bg-stone-50" />
            </div>
          </div>

          {/* Message draft placeholder skeleton */}
          <div className="border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="h-2.5 w-24 animate-pulse bg-stone-200" />
            </div>
            <div className="p-4">
              <div className="h-20 animate-pulse bg-stone-50" />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Disposition form skeleton */}
          <div className="border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="h-2.5 w-28 animate-pulse bg-stone-200" />
            </div>
            <div className="space-y-3 p-4">
              <div className="h-8 animate-pulse bg-stone-100" />
              <div className="h-16 animate-pulse bg-stone-100" />
              <div className="h-8 animate-pulse bg-stone-200" />
            </div>
          </div>

          {/* Timeline skeleton */}
          <div className="border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="h-2.5 w-32 animate-pulse bg-stone-200" />
            </div>
            <div className="divide-y divide-stone-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="mt-1.5 size-2 animate-pulse rounded-full bg-stone-200" />
                  <div className="flex-1 space-y-1">
                    <div
                      className="h-3 animate-pulse bg-stone-200"
                      style={{ width: `${70 + (i % 3) * 25}px` }}
                    />
                    <div
                      className="h-2.5 animate-pulse bg-stone-100"
                      style={{ width: `${100 + (i % 4) * 30}px` }}
                    />
                  </div>
                  <div className="h-2.5 w-12 animate-pulse bg-stone-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

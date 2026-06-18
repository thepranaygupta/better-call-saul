export default function AppLoading() {
  return (
    <div className="space-y-4">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-stone-200" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-stone-200" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-stone-200"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

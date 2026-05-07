type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-bg-elevated ${className}`}
      aria-hidden
    />
  );
}

export function BrandCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-base bg-bg-surface p-4">
      <Skeleton className="mt-1 h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-3 h-3 w-1/3" />
        <Skeleton className="mt-3 h-6 w-full" />
      </div>
    </div>
  );
}

export function BrandCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <BrandCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="rounded-lg border border-border-base bg-bg-surface p-4 space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="mt-3 h-3 w-1/4" />
    </div>
  );
}

export function TemplateCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <TemplateCardSkeleton key={i} />
      ))}
    </div>
  );
}

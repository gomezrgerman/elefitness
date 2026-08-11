import { SkeletonCard } from "@/components/skeleton";

export default function EntrenadorLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-7 w-40 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card ring-1 ring-foreground/10 p-4">
            <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

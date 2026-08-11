import { SkeletonCard } from "@/components/skeleton";

export default function ClienteLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-7 w-48 rounded-md bg-muted animate-pulse" />
      </div>
      <SkeletonCard />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

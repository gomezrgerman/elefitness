import { Skeleton } from "@/components/skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="w-48" lineas={2} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card ring-1 ring-foreground/10 p-4">
            <Skeleton lineas={2} />
          </div>
        ))}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  lineas?: number;
}

export function Skeleton({ className, lineas = 3 }: Props) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: lineas }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] animate-[skeleton_1.5s_ease-in-out_infinite]"
          style={{
            width: i === lineas - 1 ? "60%" : "100%",
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl bg-card ring-1 ring-foreground/10 p-4", className)}>
      <Skeleton lineas={3} />
    </div>
  );
}

export function SkeletonTable({ filas = 5, columnas = 4 }: { filas?: number; columnas?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {Array.from({ length: columnas }).map((_, i) => (
          <div
            key={i}
            className="h-8 flex-1 rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] animate-[skeleton_1.5s_ease-in-out_infinite]"
          />
        ))}
      </div>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: columnas }).map((_, j) => (
            <div
              key={j}
              className="h-10 flex-1 rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] animate-[skeleton_1.5s_ease-in-out_infinite]"
              style={{ animationDelay: `${(i * columnas + j) * 80}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

import { SkeletonTable } from "@/components/skeleton";

export default function AdminCobrosLoading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonTable filas={5} columnas={7} />
    </div>
  );
}

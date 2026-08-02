import Link from "next/link";
import { CerrarSesionButton } from "@/components/cerrar-sesion-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/admin/clientes">Clientes</Link>
          <Link href="/admin/clases">Clases</Link>
          <Link href="/admin/cobros">Cobros</Link>
        </nav>
        <CerrarSesionButton />
      </header>
      {children}
    </div>
  );
}

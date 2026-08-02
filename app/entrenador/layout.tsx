import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CerrarSesionButton } from "@/components/cerrar-sesion-button";

export default function EntrenadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/entrenador/clientes">Clientes</Link>
          <Link href="/entrenador/clases">Clases</Link>
          <Link href="/entrenador/cobros">Cobros</Link>
          <Badge variant="outline">Solo lectura</Badge>
        </nav>
        <CerrarSesionButton />
      </header>
      {children}
    </div>
  );
}

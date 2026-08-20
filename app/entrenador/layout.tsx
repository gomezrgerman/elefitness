"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarraLateral, SidebarLogout } from "@/components/barra-lateral";
import { BarraInferiorMovil } from "@/components/barra-inferior-movil";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  UsersIcon,
  CalendarIcon,
  CreditCardIcon,
  HomeIcon,
} from "lucide-react";

const TABS = [
  { href: "/entrenador", label: "Resumen", icono: HomeIcon },
  { href: "/entrenador/clientes", label: "Clientes", icono: UsersIcon },
  { href: "/entrenador/clases", label: "Clases", icono: CalendarIcon },
  { href: "/entrenador/cobros", label: "Cobros", icono: CreditCardIcon },
];

export default function EntrenadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <BarraLateral tabs={TABS}>
        <div className="px-3 py-2">
          <Badge variant="outline" className="w-full justify-center text-xs">
            Solo lectura
          </Badge>
        </div>
        <SidebarLogout onLogout={cerrarSesion} />
      </BarraLateral>

      <div className="flex flex-1 flex-col">
        <header className="md:hidden flex items-center justify-end gap-2 border-b border-border px-4 py-3">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Solo lectura
          </Badge>
          <Link href="/cambiar-contrasena" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Contraseña
          </Link>
          <button
            onClick={cerrarSesion}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Salir
          </button>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 animate-[fade-in-up_0.4s_var(--ease-spring)_forwards]">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>

        <BarraInferiorMovil tabs={TABS} />
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { BarraLateral, SidebarLogout } from "@/components/barra-lateral";
import { PestanasMovil } from "@/components/pestanas-movil";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  UsersIcon,
  CalendarIcon,
  CreditCardIcon,
} from "lucide-react";

const TABS = [
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
        <PestanasMovil tabs={TABS}>
          <div className="ml-auto flex items-center gap-2 pr-3">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Solo lectura
            </Badge>
            <button
              onClick={cerrarSesion}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Salir
            </button>
          </div>
        </PestanasMovil>

        <main className="flex-1 p-4 md:p-6 animate-[fade-in-up_0.4s_var(--ease-spring)_forwards]">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

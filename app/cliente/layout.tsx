"use client";

import { useRouter } from "next/navigation";
import { BarraLateral, SidebarLogout } from "@/components/barra-lateral";
import { createClient } from "@/lib/supabase/client";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <BarraLateral tabs={[]}>
        <div className="flex-1" />
        <SidebarLogout onLogout={cerrarSesion} />
      </BarraLateral>

      <div className="flex flex-1 flex-col">
        <header className="md:hidden flex items-center justify-end border-b border-border px-4 py-3">
          <button
            onClick={cerrarSesion}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar sesion
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 animate-[fade-in-up_0.4s_var(--ease-spring)_forwards]">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

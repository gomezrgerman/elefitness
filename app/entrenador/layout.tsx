"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function EntrenadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sesion, cerrarSesion } = useAppStore();

  useEffect(() => {
    if (!sesion || sesion.rol !== "entrenador") {
      router.replace("/");
    }
  }, [sesion, router]);

  if (!sesion || sesion.rol !== "entrenador") return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/entrenador/clientes">Clientes</Link>
          <Link href="/entrenador/clases">Clases</Link>
          <Link href="/entrenador/cobros">Cobros</Link>
          <Badge variant="outline">Solo lectura</Badge>
        </nav>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            cerrarSesion();
            router.push("/");
          }}
        >
          Cambiar de rol
        </Button>
      </header>
      {children}
    </div>
  );
}

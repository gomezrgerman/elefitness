"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sesion, cerrarSesion } = useAppStore();

  useEffect(() => {
    if (!sesion || sesion.rol !== "admin") {
      router.replace("/");
    }
  }, [sesion, router]);

  if (!sesion || sesion.rol !== "admin") return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/admin/clientes">Clientes</Link>
          <Link href="/admin/clases">Clases</Link>
          <Link href="/admin/cobros">Cobros</Link>
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

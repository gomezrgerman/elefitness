"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sesion, cerrarSesion } = useAppStore();

  useEffect(() => {
    if (!sesion || sesion.rol !== "cliente") {
      router.replace("/");
    }
  }, [sesion, router]);

  if (!sesion || sesion.rol !== "cliente") return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-end border-b pb-4">
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

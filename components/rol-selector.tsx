"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/mock-store";
import { usuarioIdsClientesDestacados } from "@/lib/mock-data";
import type { Rol } from "@/lib/types";

export function RolSelector() {
  const router = useRouter();
  const { usuarios, iniciarSesion } = useAppStore();

  const elena = usuarios.find((u) => u.rol === "admin");
  const ivan = usuarios.find((u) => u.rol === "entrenador");
  const clientasDestacadas = usuarioIdsClientesDestacados
    .map((id) => usuarios.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  function entrarComo(rol: Rol, usuarioId: string, ruta: string) {
    iniciarSesion(rol, usuarioId);
    router.push(ruta);
  }

  if (!elena || !ivan) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Elefitness — demo</h1>
        <p className="text-muted-foreground">Elige con que usuario quieres entrar</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="cursor-pointer hover:border-primary" onClick={() => entrarComo("admin", elena.id, "/admin")}>
          <CardHeader>
            <CardTitle>{elena.nombre}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Dueña del centro — control total</CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary" onClick={() => entrarComo("entrenador", ivan.id, "/entrenador")}>
          <CardHeader>
            <CardTitle>{ivan.nombre}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Entrenador — solo lectura</CardContent>
        </Card>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Clientas de ejemplo</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {clientasDestacadas.map((usuario) => (
            <Card
              key={usuario.id}
              className="cursor-pointer hover:border-primary"
              onClick={() => entrarComo("cliente", usuario.id, "/cliente")}
            >
              <CardHeader>
                <CardTitle className="text-base">{usuario.nombre}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" size="sm">
                  Entrar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

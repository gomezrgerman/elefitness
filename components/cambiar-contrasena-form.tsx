"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

const LONGITUD_MINIMA = 8;

export function CambiarContrasenaForm() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function guardar() {
    setError(null);
    if (nueva.length < LONGITUD_MINIMA) {
      setError(`La contraseña nueva debe tener al menos ${LONGITUD_MINIMA} caracteres`);
      return;
    }
    if (nueva !== repetir) {
      setError("Las dos contraseñas nuevas no coinciden");
      return;
    }

    setGuardando(true);
    const supabase = createClient();

    // Supabase no pide la contraseña actual para updateUser: la sesion ya
    // autenticada basta. Se re-verifica aqui con un login aparte solo para
    // confirmar que quien esta delante del teclado la conoce, antes de
    // cambiarla -- evita que una sesion abierta y olvidada (un movil
    // compartido, un ordenador del centro) permita cambiarla sin saberla.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("No se ha podido identificar tu cuenta, vuelve a iniciar sesion");
      setGuardando(false);
      return;
    }

    const { error: errorActual } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: actual,
    });
    if (errorActual) {
      setError("La contraseña actual no es correcta");
      setGuardando(false);
      return;
    }

    const { error: errorUpdate } = await supabase.auth.updateUser({ password: nueva });
    setGuardando(false);
    if (errorUpdate) {
      setError(errorUpdate.message);
      return;
    }

    toast("Contraseña actualizada", "success");
    setActual("");
    setNueva("");
    setRepetir("");
    router.back();
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>Se aplica a tu cuenta, la usaras la proxima vez que inicies sesion.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <Label htmlFor="actual">Contraseña actual</Label>
          <Input
            id="actual"
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <Label htmlFor="nueva">Contraseña nueva</Label>
          <Input
            id="nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="repetir">Repite la contraseña nueva</Label>
          <Input
            id="repetir"
            type="password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={guardar} disabled={guardando} className="mt-1">
          {guardando ? "Guardando..." : "Guardar contraseña"}
        </Button>
      </CardContent>
    </Card>
  );
}

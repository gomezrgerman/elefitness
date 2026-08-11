"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { DumbbellIcon } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrarCon(emailEntrada: string, passwordEntrada: string) {
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: emailEntrada,
      password: passwordEntrada,
    });
    setCargando(false);
    if (errorLogin) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/20">
            <DumbbellIcon className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Elefitness</h1>
          <p className="text-muted-foreground">Inicia sesion</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email y contraseña</CardTitle>
          </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button disabled={cargando} onClick={() => entrarCon(email, password)}>
            Entrar
          </Button>
        </CardContent>
      </Card>
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Acceso rápido (solo demo)</h2>
        <div className="grid gap-2">
          {DEMO_ACCOUNTS.map((cuenta) => (
            <Button
              key={cuenta.email}
              variant="outline"
              disabled={cargando}
              onClick={() => entrarCon(cuenta.email, DEMO_PASSWORD)}
            >
              {cuenta.nombre} · {cuenta.rol}
            </Button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

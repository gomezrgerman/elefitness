import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CambiarContrasenaForm } from "@/components/cambiar-contrasena-form";

// Ruta compartida por los tres roles: no vive bajo app/admin, app/entrenador
// ni app/cliente porque cualquier cuenta autenticada la necesita igual.
export default async function CambiarContrasenaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          Volver
        </Link>
        <CambiarContrasenaForm />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarios } from "@/lib/supabase/queries";
import { usuarioPorId } from "@/lib/selectors";

// Sin este reparto por rol, "/" siempre mandaba a /login incluso ya
// autenticada: tras entrar, router.push("/") de la pantalla de login volvia
// a caer aqui y de aqui otra vez a /login, en vez de al panel de cada una.
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const usuarios = await obtenerUsuarios();
  const usuario = usuarioPorId(usuarios, user.id);
  if (!usuario) redirect("/login");

  if (usuario.rol === "admin") redirect("/admin");
  if (usuario.rol === "entrenador") redirect("/entrenador");
  redirect("/cliente");
}

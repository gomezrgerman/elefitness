// Vacia por completo el proyecto Supabase al que apunte .env.local, en orden de
// claves foraneas, para poder volver a correr `npm run seed` (que aborta si la
// tabla centro ya tiene datos). Es la contraparte del seed durante el
// desarrollo — nunca debe correrse contra el proyecto del centro en produccion.
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";

const admin = createAdminClient();

const TABLAS = [
  "reservas_historial",
  "reservas",
  "sesiones",
  "bonos_cliente",
  "pagos",
  "clientes",
  "clases",
  "planes",
] as const;

const CONFIRMACION = "si-borrar-todo";

async function main() {
  // Borra todas las clientas, reservas y cobros del proyecto: se exige teclear
  // la confirmacion para que no baste con recuperar el comando del historial.
  if (process.argv[2] !== CONFIRMACION) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(sin NEXT_PUBLIC_SUPABASE_URL)";
    throw new Error(
      `Esto vacia TODOS los datos de ${url}.\n` +
        `Si es lo que quieres: npm run reset:dev -- ${CONFIRMACION}`
    );
  }

  for (const tabla of TABLAS) {
    const { error } = await admin.from(tabla).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`${tabla}: ${error.message}`);
    console.log(`vaciada ${tabla}`);
  }

  const { data: usuarios, error: errorUsuarios } = await admin.from("users").select("id");
  if (errorUsuarios) throw errorUsuarios;
  for (const u of usuarios ?? []) {
    const { error } = await admin.from("users").delete().eq("id", u.id);
    if (error) throw error;
    const { error: errorAuth } = await admin.auth.admin.deleteUser(u.id);
    if (errorAuth) throw errorAuth;
  }
  console.log(`vaciada users (${usuarios?.length ?? 0} cuentas)`);

  const { error: errorCentro } = await admin.from("centro").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errorCentro) throw errorCentro;
  console.log("vaciada centro");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);

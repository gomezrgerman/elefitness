// Importa las 104 clientas reales del Excel que Elena le paso a German
// (info/clientes_export.csv, exportado del .xlsx original -- ver
// info/Base de datos clientes.xlsx) a la base de pruebas, para validar el
// modelo real a escala antes de migrar a produccion. NO toca a Elena, Ivan
// ni las clientas de ejemplo (maria/laura/sara/...) que ya existen del seed.
//
// El Excel no trae email: cada clienta se da de alta con un email placeholder
// (nombre.apellido@clientes-excel.elefitness.test) solo para poder crear la
// cuenta de Auth -- no son cuentas con las que nadie vaya a iniciar sesion
// todavia. Cuando German tenga los emails reales, hay que actualizarlos.
//
// Reglas de negocio aplicadas (confirmadas por German/Elena, 2026-08-19/20):
// - Diana Argiles y Marta Bosque Rico: el Excel decia 90 EUR pero el plan
//   real es Basico (50 EUR) -- se fuerza aqui, no se usa el literal del Excel.
// - 5 filas marcadas solo "Bono" sin detalle, resueltas una a una: Cristina
//   Alonso Sevilla / Elena Candamin Botella / Alicia Leonarte Sierra ->
//   Bono 12 sesiones (120, Stripe); Ester Llopis Lucas -> Bono 10 sesiones
//   (130, Stripe); Meritxell Martinez Leonarte -> Bono 12 sesiones (120,
//   Efectivo).
// - Carmen Ortega Gonzalez y Africa Baixauli Lafuente: Bono 12 sesiones,
//   pero "hasta octubre no vendran" -> se dan de alta ya de baja (con su
//   plan/bono asignado, listas para reactivar). El metodo de pago no lo dio
//   Elena para estas dos -- se deja "efectivo" como valor provisional, sin
//   inventar que ya esta cobrando por Stripe; German debe confirmarlo.
// - El resto de filas sin ningun dato (plan/cuota/metodo en blanco): clienta
//   "en el aire" segun Elena (se han ido, podrian volver) -> de alta directamente
//   de baja, sin plan ni pago, tal como ya soporta el formulario ("Sin plan").
// - "Personalizado": van al plan "Cuota personalizada" (precio de catalogo 0,
//   sin Stripe), pero con el importe real que trae el Excel en su fila.

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { join } from "path";
import { createAdminClient } from "../lib/supabase/admin";
import { hoyEnEspana, sumarMesesMismoDia } from "../lib/fechas";

const admin = createAdminClient();

// Permite apuntar a un CSV de prueba (subconjunto pequeno) sin tocar el
// fichero real, para validar el script antes de correrlo sobre las 104.
const RUTA_CSV = process.env.IMPORT_CSV_PATH ?? join(__dirname, "..", "info", "clientes_export.csv");

interface FilaExcel {
  nombres: string;
  apellidos: string;
  plan: string;
  cuota: string;
  dias: string;
  metodo: string;
}

function leerCsv(): FilaExcel[] {
  const contenido = readFileSync(RUTA_CSV, "utf-8");
  const lineas = contenido.split(/\r?\n/).slice(2); // salta la fila vacia inicial y la cabecera
  const filas: FilaExcel[] = [];
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const [nombres, apellidos, plan, cuota, dias, metodo] = linea.split(",").map((v) => v.trim());
    if (!nombres && !apellidos) continue;
    filas.push({ nombres, apellidos, plan, cuota, dias, metodo });
  }
  return filas;
}

// Bonos "sin detalle" en el Excel, resueltos individualmente por Elena.
const BONOS_RESUELTOS: Record<string, { plan: "Bono 12 sesiones" | "Bono 10 sesiones"; metodo: "stripe" | "efectivo" }> = {
  "Cristina|Alonso  Sevilla": { plan: "Bono 12 sesiones", metodo: "stripe" },
  "Elena|Candamin Botella": { plan: "Bono 12 sesiones", metodo: "stripe" },
  "Alicia|Leonarte Sierra": { plan: "Bono 12 sesiones", metodo: "stripe" },
  "Ester|Llopis Lucas": { plan: "Bono 10 sesiones", metodo: "stripe" },
  "Meritxell|Martínez Leonarte": { plan: "Bono 12 sesiones", metodo: "efectivo" },
};

// Confirmadas por Elena pero sin metodo de pago explicito -- se dan de alta
// de baja (vuelven en octubre) con Bono 12 sesiones asignado.
const PAUSADAS_CON_BONO = new Set(["Carmen|Ortega González", "África|Baixauli Lafuente"]);

// El Excel trae 90 EUR para estas dos pero el plan real es Basico (50 EUR).
const FORZAR_BASICO = new Set(["Diana|Argiles", "Marta|Bosque Rico"]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function emailPlaceholder(nombres: string, apellidos: string, usados: Set<string>): string {
  const base = `${normalizar(nombres)}.${normalizar(apellidos)}`;
  let email = `${base}@clientes-excel.elefitness.test`;
  let sufijo = 2;
  while (usados.has(email)) {
    email = `${base}.${sufijo}@clientes-excel.elefitness.test`;
    sufijo += 1;
  }
  usados.add(email);
  return email;
}

const NOMBRE_PLAN_EXCEL_A_CATALOGO: Record<string, string> = {
  "Plan Básico": "Basico",
  "Plan Básico reducido": "Basico reducido",
  "Plan Fit": "Fit",
  "Plan Fit reducido": "Fit reducido",
  "Plan Fit Plus": "Fit Plus",
  "Plan Fit Plus reducido": "Fit Plus reducido",
  "Plan Fit Plus (cuota apertura)": "Fit Plus cuota apertura",
};

async function main() {
  const filas = leerCsv();
  console.log(`Filas leidas del Excel: ${filas.length}`);

  const { data: elena, error: errorElena } = await admin
    .from("users")
    .select("id")
    .eq("email", "elena@elefitness.com")
    .single();
  if (errorElena || !elena) throw errorElena ?? new Error("No se encontro a Elena en la base de pruebas");

  const { data: planes, error: errorPlanes } = await admin.from("planes").select("id, nombre, precio, tipo, clases_incluidas");
  if (errorPlanes || !planes) throw errorPlanes ?? new Error("No se pudieron leer los planes");
  const planPorNombre = new Map(planes.map((p) => [p.nombre, p]));
  const planCuotaPersonalizada = planPorNombre.get("Cuota personalizada");
  if (!planCuotaPersonalizada) throw new Error("No existe el plan 'Cuota personalizada'");

  const hoy = hoyEnEspana();
  const proximoCobro = sumarMesesMismoDia(hoy, 1);
  const emailsUsados = new Set<string>();

  let creadas = 0;
  let conPlan = 0;
  let sinPlan = 0;
  let pausadas = 0;

  for (const fila of filas) {
    const clave = `${fila.nombres}|${fila.apellidos}`;
    const nombreCompleto = `${fila.nombres} ${fila.apellidos}`;

    let planId: string | null = null;
    let importe: number | null = null;
    let metodo: "stripe" | "efectivo" | "transferencia" | null = null;
    let tipoPlan: "mensual" | "bono" | null = null;
    let diasSemana = fila.dias ? parseInt(fila.dias, 10) : 1;
    if (!Number.isInteger(diasSemana) || diasSemana < 1) diasSemana = 1;
    let estado: "activo" | "baja" = "activo";

    if (FORZAR_BASICO.has(clave)) {
      const plan = planPorNombre.get("Basico")!;
      planId = plan.id;
      tipoPlan = "mensual";
      importe = plan.precio;
      metodo = (fila.metodo?.toLowerCase() as "stripe" | "efectivo") || "stripe";
    } else if (PAUSADAS_CON_BONO.has(clave)) {
      const plan = planPorNombre.get("Bono 12 sesiones")!;
      planId = plan.id;
      tipoPlan = "bono";
      importe = plan.precio;
      metodo = "efectivo"; // provisional, Elena no dio el metodo -- confirmar
      estado = "baja";
      pausadas += 1;
    } else if (BONOS_RESUELTOS[clave]) {
      const resuelto = BONOS_RESUELTOS[clave];
      const plan = planPorNombre.get(resuelto.plan)!;
      planId = plan.id;
      tipoPlan = "bono";
      importe = plan.precio;
      metodo = resuelto.metodo;
    } else if (fila.plan === "Personalizado") {
      planId = planCuotaPersonalizada.id;
      tipoPlan = "mensual";
      importe = parseFloat(fila.cuota);
      metodo = (fila.metodo?.toLowerCase() as "efectivo" | "stripe") || "efectivo";
    } else if (fila.plan && NOMBRE_PLAN_EXCEL_A_CATALOGO[fila.plan]) {
      const nombreCatalogo = NOMBRE_PLAN_EXCEL_A_CATALOGO[fila.plan];
      const plan = planPorNombre.get(nombreCatalogo);
      if (!plan) throw new Error(`Plan de catalogo no encontrado: ${nombreCatalogo} (fila: ${nombreCompleto})`);
      planId = plan.id;
      tipoPlan = plan.tipo;
      importe = plan.precio;
      metodo = (fila.metodo?.toLowerCase() as "stripe" | "efectivo") || "stripe";
    } else {
      // Sin plan, sin cuota, sin metodo: clienta "en el aire" que Elena
      // quiere tener visible aunque no este entrenando ahora mismo.
      estado = "baja";
      sinPlan += 1;
    }

    const email = emailPlaceholder(fila.nombres, fila.apellidos, emailsUsados);

    const { data: authUser, error: errorAuth } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (errorAuth || !authUser.user) throw errorAuth ?? new Error(`No se pudo crear auth user para ${nombreCompleto}`);

    const { error: errorUsers } = await admin.from("users").insert({
      id: authUser.user.id,
      email,
      rol: "cliente",
      nombre: nombreCompleto,
      telefono: "",
    });
    if (errorUsers) throw errorUsers;

    const { data: cliente, error: errorCliente } = await admin
      .from("clientes")
      .insert({
        usuario_id: authUser.user.id,
        plan_id: planId,
        estado,
        notas_rutina: "",
        dias_semana_habituales: diasSemana,
      })
      .select()
      .single();
    if (errorCliente || !cliente) throw errorCliente ?? new Error(`No se pudo crear clienta ${nombreCompleto}`);

    if (planId && importe !== null && metodo && tipoPlan) {
      const { error: errorPago } = await admin.from("pagos").insert({
        cliente_id: cliente.id,
        plan_id: planId,
        tipo: tipoPlan,
        metodo,
        estado: "al_dia",
        importe,
        fecha_pago: hoy,
        ultimo_cobro: hoy,
        proximo_cobro: tipoPlan === "mensual" ? proximoCobro : null,
        registrado_por: elena.id,
      });
      if (errorPago) throw errorPago;

      if (tipoPlan === "bono") {
        const plan = planes.find((p) => p.id === planId)!;
        const { error: errorBono } = await admin.rpc("crear_bono", {
          p_cliente_id: cliente.id,
          p_plan_id: planId,
          p_creditos_totales: plan.clases_incluidas ?? 0,
          p_fecha_compra: hoy,
          p_tipo: "normal",
        });
        if (errorBono) throw errorBono;
      }
      conPlan += 1;
    }

    creadas += 1;
    if (creadas % 10 === 0) console.log(`  ... ${creadas}/${filas.length}`);
  }

  console.log(`\nListo. ${creadas} clientas creadas (${conPlan} con plan, ${sinPlan} sin plan, ${pausadas} pausadas con bono).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error importando clientas:", err);
    process.exit(1);
  });

import { formatearDiaLargo } from "@/lib/fechas";

// Plantillas simples en HTML con estilos inline (necesario para que se vean
// bien en clientes de correo, que no soportan CSS externo ni casi nada de
// CSS moderno). Paleta de marca de Elefitness, la misma de la web y la app.
const COLOR_BG = "#171918";
const COLOR_TEXT = "#F4F4EF";
const COLOR_MUTED = "#A7ADAA";
const COLOR_ACCENT = "#78A8A2";

function plantillaBase(titulo: string, cuerpo: string): string {
  return `
    <div style="background:${COLOR_BG};padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#232625;border-radius:16px;padding:32px;">
        <p style="color:${COLOR_ACCENT};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">Elefitness</p>
        <h1 style="color:${COLOR_TEXT};font-size:22px;margin:0 0 16px;">${titulo}</h1>
        ${cuerpo}
      </div>
    </div>
  `;
}

interface DatosSesion {
  nombreCliente: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export function emailConfirmacionReserva({ nombreCliente, fecha, horaInicio, horaFin }: DatosSesion) {
  return {
    subject: `Reserva confirmada: ${formatearDiaLargo(fecha)}`,
    html: plantillaBase(
      "Tu plaza está confirmada",
      `<p style="color:${COLOR_TEXT};font-size:15px;line-height:1.5;margin:0 0 16px;">Hola ${nombreCliente}, tu reserva ha quedado confirmada:</p>
       <p style="color:${COLOR_TEXT};font-size:15px;line-height:1.5;margin:0 0 24px;background:#2D3130;border-radius:8px;padding:12px 16px;">
         ${formatearDiaLargo(fecha)}<br/>${horaInicio} – ${horaFin}
       </p>
       <p style="color:${COLOR_MUTED};font-size:13px;margin:0;">Si no puedes venir, cancela desde la app con al menos 24h de antelación.</p>`
    ),
  };
}

export function emailListaEspera({ nombreCliente, fecha, horaInicio, horaFin }: DatosSesion) {
  return {
    subject: `Estás en lista de espera: ${formatearDiaLargo(fecha)}`,
    html: plantillaBase(
      "Estás en lista de espera",
      `<p style="color:${COLOR_TEXT};font-size:15px;line-height:1.5;margin:0 0 16px;">Hola ${nombreCliente}, esta clase estaba completa, así que has entrado en lista de espera:</p>
       <p style="color:${COLOR_TEXT};font-size:15px;line-height:1.5;margin:0 0 24px;background:#2D3130;border-radius:8px;padding:12px 16px;">
         ${formatearDiaLargo(fecha)}<br/>${horaInicio} – ${horaFin}
       </p>
       <p style="color:${COLOR_MUTED};font-size:13px;margin:0;">Si se libera una plaza, entrarás automáticamente y te avisaremos.</p>`
    ),
  };
}

export function emailCobroFallido({ nombreCliente }: { nombreCliente: string }) {
  return {
    subject: "No hemos podido procesar tu cobro",
    html: plantillaBase(
      "No hemos podido procesar tu cobro",
      `<p style="color:${COLOR_TEXT};font-size:15px;line-height:1.5;margin:0 0 16px;">Hola ${nombreCliente}, hemos intentado cobrar tu cuota y no se ha podido completar.</p>
       <p style="color:${COLOR_TEXT};font-size:15px;line-height:1.5;margin:0 0 16px;">Revisa que tu tarjeta esté al día, o contacta con Elena si necesitas ayuda.</p>`
    ),
  };
}

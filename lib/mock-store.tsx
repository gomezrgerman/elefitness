"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  centro,
  usuarios as usuariosSeed,
  planes,
  clases,
  clientesSeed,
  reservasSeed,
  pagosSeed,
  bonosClienteSeed,
} from "./mock-data";
import type { Cliente, Reserva, Rol } from "./types";
import {
  plazasLibres,
  reservaActivaDeClienteEnClase,
  clientePorId,
  planPorId,
  bonoDeCliente,
  creditosRestantes,
  pagoDeCliente,
} from "./selectors";

interface Sesion {
  rol: Rol;
  usuarioId: string;
}

interface DatosNuevoCliente {
  nombre: string;
  email: string;
  telefono: string;
  planId: string;
  notasRutina: string;
}

interface AppStore {
  centro: typeof centro;
  usuarios: typeof usuariosSeed;
  planes: typeof planes;
  clases: typeof clases;
  clientes: Cliente[];
  reservas: Reserva[];
  pagos: typeof pagosSeed;
  bonosCliente: typeof bonosClienteSeed;
  sesion: Sesion | null;
  iniciarSesion: (rol: Rol, usuarioId: string) => void;
  cerrarSesion: () => void;
  reservarClase: (claseId: string, clienteId: string) => void;
  cancelarReserva: (reservaId: string) => void;
  altaCliente: (datos: DatosNuevoCliente) => void;
  bajaCliente: (clienteId: string) => void;
  reactivarCliente: (clienteId: string) => void;
  actualizarCliente: (clienteId: string, datos: Partial<Pick<Cliente, "planId" | "notasRutina">>) => void;
}

const AppStoreContext = createContext<AppStore | null>(null);

let contadorId = 1;
function idUnico(prefijo: string): string {
  contadorId += 1;
  return `${prefijo}-${contadorId}`;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [usuarios, setUsuarios] = useState(usuariosSeed);
  const [clientes, setClientes] = useState<Cliente[]>(clientesSeed);
  const [reservas, setReservas] = useState<Reserva[]>(reservasSeed);
  const [pagos, setPagos] = useState(pagosSeed);
  const [bonosCliente, setBonosCliente] = useState(bonosClienteSeed);

  const iniciarSesion = useCallback((rol: Rol, usuarioId: string) => {
    setSesion({ rol, usuarioId });
  }, []);

  const cerrarSesion = useCallback(() => setSesion(null), []);

  const reservarClase = useCallback(
    (claseId: string, clienteId: string) => {
      const yaActiva = reservaActivaDeClienteEnClase(reservas, clienteId, claseId);
      if (yaActiva) return;
      const clase = clases.find((c) => c.id === claseId);
      if (!clase) return;

      const cliente = clientePorId(clientes, clienteId);
      const plan = cliente ? planPorId(planes, cliente.planId) : undefined;
      let bono = undefined as ReturnType<typeof bonoDeCliente>;
      if (plan?.tipo === "bono") {
        bono = bonoDeCliente(bonosCliente, clienteId);
        if (!bono || creditosRestantes(bono) <= 0) return; // sin credito disponible, no se puede reservar
      }

      const libres = plazasLibres(clase, reservas);
      const estado = libres > 0 ? "confirmada" : "lista_espera";
      const nueva: Reserva = {
        id: idUnico("r"),
        claseId,
        clienteId,
        estado,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setReservas((actuales) => [...actuales, nueva]);

      if (estado === "confirmada" && bono) {
        const bonoId = bono.id;
        setBonosCliente((actuales) =>
          actuales.map((b) => (b.id === bonoId ? { ...b, creditosUsados: b.creditosUsados + 1 } : b))
        );
      }
    },
    [reservas, clientes, bonosCliente]
  );

  const cancelarReserva = useCallback(
    (reservaId: string) => {
      const objetivo = reservas.find((r) => r.id === reservaId);
      if (!objetivo) return;

      const restantes = reservas.map((r) =>
        r.id === reservaId ? { ...r, estado: "cancelada" as const } : r
      );

      if (objetivo.estado !== "confirmada") {
        setReservas(restantes);
        return;
      }

      // Cancelar una reserva confirmada de un cliente con bono devuelve el credito.
      const clienteObjetivo = clientePorId(clientes, objetivo.clienteId);
      const planObjetivo = clienteObjetivo ? planPorId(planes, clienteObjetivo.planId) : undefined;
      if (planObjetivo?.tipo === "bono") {
        const bonoObjetivo = bonoDeCliente(bonosCliente, objetivo.clienteId);
        if (bonoObjetivo) {
          const bonoId = bonoObjetivo.id;
          setBonosCliente((actuales) =>
            actuales.map((b) =>
              b.id === bonoId ? { ...b, creditosUsados: Math.max(0, b.creditosUsados - 1) } : b
            )
          );
        }
      }

      const siguienteEnEspera = restantes
        .filter((r) => r.claseId === objetivo.claseId && r.estado === "lista_espera")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

      if (!siguienteEnEspera) {
        setReservas(restantes);
        return;
      }

      setReservas(
        restantes.map((r) => (r.id === siguienteEnEspera.id ? { ...r, estado: "confirmada" as const } : r))
      );

      // Promocionar de lista de espera a confirmada cobra el credito si el promovido usa bono.
      const clientePromovido = clientePorId(clientes, siguienteEnEspera.clienteId);
      const planPromovido = clientePromovido ? planPorId(planes, clientePromovido.planId) : undefined;
      if (planPromovido?.tipo === "bono") {
        const bonoPromovido = bonoDeCliente(bonosCliente, siguienteEnEspera.clienteId);
        if (bonoPromovido) {
          const bonoId = bonoPromovido.id;
          setBonosCliente((actuales) =>
            actuales.map((b) => (b.id === bonoId ? { ...b, creditosUsados: b.creditosUsados + 1 } : b))
          );
        }
      }
    },
    [reservas, clientes, bonosCliente]
  );

  const altaCliente = useCallback(
    (datos: DatosNuevoCliente) => {
      const usuarioId = idUnico("u");
      const clienteId = idUnico("c");
      const fechaHoy = new Date().toISOString().slice(0, 10);
      const plan = planPorId(planes, datos.planId);

      setUsuarios((actuales) => [
        ...actuales,
        { id: usuarioId, email: datos.email, rol: "cliente" as const, nombre: datos.nombre, telefono: datos.telefono },
      ]);
      setClientes((actuales) => [
        ...actuales,
        {
          id: clienteId,
          usuarioId,
          estado: "activo" as const,
          planId: datos.planId,
          notasRutina: datos.notasRutina,
          createdAt: fechaHoy,
        },
      ]);

      if (plan && sesion) {
        setPagos((actuales) => [
          ...actuales,
          {
            id: idUnico("p"),
            clienteId,
            planId: plan.id,
            tipo: plan.tipo,
            metodo: plan.tipo === "mensual" ? ("stripe" as const) : ("efectivo" as const),
            estado: "pendiente" as const,
            importe: plan.precio,
            fechaPago: fechaHoy,
            ultimoCobro: null,
            proximoCobro: null,
            registradoPor: sesion.usuarioId,
          },
        ]);

        if (plan.tipo === "bono") {
          setBonosCliente((actuales) => [
            ...actuales,
            {
              id: idUnico("b"),
              clienteId,
              planId: plan.id,
              creditosTotales: plan.clasesIncluidas ?? 0,
              creditosUsados: 0,
              fechaCompra: fechaHoy,
              activo: true,
            },
          ]);
        }
      }
    },
    [sesion]
  );

  const bajaCliente = useCallback((clienteId: string) => {
    setClientes((actuales) => actuales.map((c) => (c.id === clienteId ? { ...c, estado: "baja" as const } : c)));
  }, []);

  const reactivarCliente = useCallback((clienteId: string) => {
    setClientes((actuales) => actuales.map((c) => (c.id === clienteId ? { ...c, estado: "activo" as const } : c)));
  }, []);

  const actualizarCliente = useCallback(
    (clienteId: string, datos: Partial<Pick<Cliente, "planId" | "notasRutina">>) => {
      const clienteActual = clientePorId(clientes, clienteId);
      const cambiaPlan = Boolean(datos.planId) && clienteActual !== undefined && datos.planId !== clienteActual.planId;

      setClientes((actuales) => actuales.map((c) => (c.id === clienteId ? { ...c, ...datos } : c)));

      if (cambiaPlan && datos.planId) {
        const nuevoPlan = planPorId(planes, datos.planId);
        if (nuevoPlan) {
          setPagos((actuales) => {
            const pagoExistente = pagoDeCliente(actuales, clienteId);
            if (!pagoExistente) return actuales;
            return actuales.map((p) =>
              p.id === pagoExistente.id
                ? { ...p, planId: nuevoPlan.id, tipo: nuevoPlan.tipo, importe: nuevoPlan.precio }
                : p
            );
          });

          if (nuevoPlan.tipo === "bono") {
            const bonoActivo = bonoDeCliente(bonosCliente, clienteId);
            if (!bonoActivo) {
              setBonosCliente((actuales) => [
                ...actuales,
                {
                  id: idUnico("b"),
                  clienteId,
                  planId: nuevoPlan.id,
                  creditosTotales: nuevoPlan.clasesIncluidas ?? 0,
                  creditosUsados: 0,
                  fechaCompra: new Date().toISOString().slice(0, 10),
                  activo: true,
                },
              ]);
            }
          } else if (nuevoPlan.tipo === "mensual") {
            // El cliente deja de usar bono: se desactiva el bono existente (se conserva como historico).
            const bonoActivo = bonoDeCliente(bonosCliente, clienteId);
            if (bonoActivo) {
              const bonoId = bonoActivo.id;
              setBonosCliente((actuales) => actuales.map((b) => (b.id === bonoId ? { ...b, activo: false } : b)));
            }
          }
        }
      }
    },
    [clientes, bonosCliente]
  );

  const value = useMemo<AppStore>(
    () => ({
      centro,
      usuarios,
      planes,
      clases,
      clientes,
      reservas,
      pagos,
      bonosCliente,
      sesion,
      iniciarSesion,
      cerrarSesion,
      reservarClase,
      cancelarReserva,
      altaCliente,
      bajaCliente,
      reactivarCliente,
      actualizarCliente,
    }),
    [
      usuarios,
      clientes,
      reservas,
      pagos,
      bonosCliente,
      sesion,
      iniciarSesion,
      cerrarSesion,
      reservarClase,
      cancelarReserva,
      altaCliente,
      bajaCliente,
      reactivarCliente,
      actualizarCliente,
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore debe usarse dentro de AppStoreProvider");
  return ctx;
}

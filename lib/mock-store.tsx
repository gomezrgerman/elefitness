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
import { plazasLibres, reservaActivaDeClienteEnClase } from "./selectors";

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
  const [pagos] = useState(pagosSeed);
  const [bonosCliente] = useState(bonosClienteSeed);

  const iniciarSesion = useCallback((rol: Rol, usuarioId: string) => {
    setSesion({ rol, usuarioId });
  }, []);

  const cerrarSesion = useCallback(() => setSesion(null), []);

  const reservarClase = useCallback((claseId: string, clienteId: string) => {
    setReservas((actuales) => {
      const yaActiva = reservaActivaDeClienteEnClase(actuales, clienteId, claseId);
      if (yaActiva) return actuales;
      const clase = clases.find((c) => c.id === claseId);
      if (!clase) return actuales;
      const libres = plazasLibres(clase, actuales);
      const estado = libres > 0 ? "confirmada" : "lista_espera";
      const nueva: Reserva = {
        id: idUnico("r"),
        claseId,
        clienteId,
        estado,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      return [...actuales, nueva];
    });
  }, []);

  const cancelarReserva = useCallback((reservaId: string) => {
    setReservas((actuales) => {
      const objetivo = actuales.find((r) => r.id === reservaId);
      if (!objetivo) return actuales;
      const restantes = actuales.map((r) =>
        r.id === reservaId ? { ...r, estado: "cancelada" as const } : r
      );
      if (objetivo.estado !== "confirmada") return restantes;
      const siguienteEnEspera = restantes
        .filter((r) => r.claseId === objetivo.claseId && r.estado === "lista_espera")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!siguienteEnEspera) return restantes;
      return restantes.map((r) =>
        r.id === siguienteEnEspera.id ? { ...r, estado: "confirmada" as const } : r
      );
    });
  }, []);

  const altaCliente = useCallback((datos: DatosNuevoCliente) => {
    const usuarioId = idUnico("u");
    const clienteId = idUnico("c");
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
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
  }, []);

  const bajaCliente = useCallback((clienteId: string) => {
    setClientes((actuales) => actuales.map((c) => (c.id === clienteId ? { ...c, estado: "baja" as const } : c)));
  }, []);

  const reactivarCliente = useCallback((clienteId: string) => {
    setClientes((actuales) => actuales.map((c) => (c.id === clienteId ? { ...c, estado: "activo" as const } : c)));
  }, []);

  const actualizarCliente = useCallback(
    (clienteId: string, datos: Partial<Pick<Cliente, "planId" | "notasRutina">>) => {
      setClientes((actuales) => actuales.map((c) => (c.id === clienteId ? { ...c, ...datos } : c)));
    },
    []
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

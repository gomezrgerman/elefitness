import { CerrarSesionButton } from "@/components/cerrar-sesion-button";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-end border-b pb-4">
        <CerrarSesionButton />
      </header>
      {children}
    </div>
  );
}

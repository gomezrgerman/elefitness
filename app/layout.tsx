import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { RegistrarServiceWorker } from "@/components/registrar-service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Necesario para que el og:image se resuelva como URL absoluta al compartir
// el link (WhatsApp, etc.). Actualizar si el dominio publico cambia -- hoy
// se comparte desde el link privado de Vercel a proposito (ver memoria del
// proyecto: app.elefitness.es no esta conectado).
const URL_BASE = "https://elefitness.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(URL_BASE),
  title: "Elefitness",
  description: "Panel del centro de entrenamiento",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Elefitness",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Elefitness",
    description: "Panel del centro de entrenamiento",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elefitness",
    description: "Panel del centro de entrenamiento",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#171918",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RegistrarServiceWorker />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

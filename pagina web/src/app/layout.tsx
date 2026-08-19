import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SmoothScrollProvider } from "@/components/motion/smooth-scroll-provider";
import { siteConfig } from "@/content/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Elefitness — Entrenamiento personal en Valencia",
  description:
    "Entrenamiento personal y en grupos reducidos en Valencia, adaptado a tu nivel, tu cuerpo y tus objetivos.",
  openGraph: {
    title: "Elefitness — Entrenamiento personal en Valencia",
    description:
      "Entrenamiento personal y en grupos reducidos en Valencia, adaptado a tu nivel, tu cuerpo y tus objetivos.",
    type: "website",
    siteName: "Elefitness",
    images: ["/og.png"],
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HealthClub",
  name: siteConfig.name,
  description:
    "Entrenamiento personal y en grupos reducidos, adaptado a tu nivel, tu cuerpo y tus objetivos.",
  telephone: `+34${siteConfig.phone.replace(/ /g, "")}`,
  sameAs: [siteConfig.instagramUrl],
  address: {
    "@type": "PostalAddress",
    streetAddress: "Plaça d'Enric Granados, 15",
    addressLocality: "València",
    addressRegion: "Valencia",
    postalCode: "46018",
    addressCountry: "ES",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Wednesday"],
      opens: "07:00",
      closes: "21:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Tuesday", "Thursday"],
      opens: "07:00",
      closes: "13:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Tuesday", "Thursday"],
      opens: "16:00",
      closes: "21:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Friday",
      opens: "09:00",
      closes: "16:00",
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={geistSans.variable}>
      <body className="bg-bg font-body text-text antialiased">
        <SmoothScrollProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </SmoothScrollProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd),
          }}
        />
      </body>
    </html>
  );
}

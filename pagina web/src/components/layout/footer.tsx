import { ExternalLink } from "@/components/ui/external-link";
import { siteConfig } from "@/content/site";

export function Footer() {
  return (
    <footer
      id="contacto"
      className="bg-bg-soft px-6 py-16 text-text lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-section font-display font-semibold leading-[1.05]">
          {siteConfig.tagline}
        </p>

        <div className="mt-12 grid grid-cols-1 gap-10 border-t border-border pt-10 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Contacto
            </p>
            <p className="mt-3 text-sm text-text/80">{siteConfig.address}</p>
            <p className="mt-1 text-sm">
              <ExternalLink
                href={`tel:+34${siteConfig.phone.replace(/\s/g, "")}`}
                className="text-text/80 hover:text-accent"
              >
                {siteConfig.phone}
              </ExternalLink>
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Horario
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text/80">
              {siteConfig.hours}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Síguenos
            </p>
            <p className="mt-3 text-sm">
              <ExternalLink
                href={siteConfig.instagramUrl}
                className="text-text/80 hover:text-accent"
              >
                Instagram
              </ExternalLink>
            </p>
            <p className="mt-3 text-sm">
              <ExternalLink
                href={siteConfig.whatsappUrl}
                className="text-text/80 hover:text-accent"
              >
                Escríbenos por WhatsApp
              </ExternalLink>
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Todos los
            derechos reservados.
          </p>
          <p>Aviso legal, privacidad y cookies — próximamente.</p>
        </div>
      </div>
    </footer>
  );
}

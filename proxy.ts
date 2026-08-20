import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_POR_ROL: Record<string, string> = {
  admin: "/admin",
  entrenador: "/entrenador",
  cliente: "/cliente",
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaPublica = pathname === "/login";

  if (!user) {
    if (!esRutaPublica) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
    return response;
  }

  const { data: perfil } = await supabase.from("users").select("rol").eq("id", user.id).single();
  const rutaDelRol = perfil ? RUTAS_POR_ROL[perfil.rol] : null;

  if (!rutaDelRol) {
    if (!esRutaPublica) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
    return response;
  }

  if (pathname === "/" || pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = rutaDelRol;
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (!pathname.startsWith(rutaDelRol)) {
    const url = request.nextUrl.clone();
    url.pathname = rutaDelRol;
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

// Las rutas /api/* (hoy solo el webhook de Stripe) gestionan su propia
// autenticacion -- la firma de Stripe, no una sesion de usuario -- asi que
// quedan fuera de este middleware. Sin esta exclusion, una peticion de
// Stripe (sin cookie de sesion) se redirigia a /login antes de llegar al
// route handler, y el webhook nunca se ejecutaba.
//
// Los ficheros estaticos (manifest.webmanifest, sw.js, iconos...) tampoco
// necesitan sesion. El mismo bug que rompia el webhook rompia tambien el
// manifest y el service worker de la PWA: un navegador sin sesion pedia
// /manifest.webmanifest o /sw.js, el middleware los redirigia (307) a
// /login, y ni el manifest se leia ni el service worker podia registrarse
// (los navegadores rechazan un redirect en la respuesta de un service
// worker). Se excluye por extension en vez de listar cada fichero uno a
// uno, para que no vuelva a pasar con el proximo asset que se añada a
// public/.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api|.*\\.(?:png|ico|svg|js|json|webmanifest|txt|xml)$).*)",
  ],
};

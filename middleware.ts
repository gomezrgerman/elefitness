import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_POR_ROL: Record<string, string> = {
  admin: "/admin",
  entrenador: "/entrenador",
  cliente: "/cliente",
};

export async function middleware(request: NextRequest) {
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
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { data: perfil } = await supabase.from("users").select("rol").eq("id", user.id).single();
  const rutaDelRol = perfil ? RUTAS_POR_ROL[perfil.rol] : null;

  if (!rutaDelRol) {
    return response;
  }

  if (pathname === "/" || pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = rutaDelRol;
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith(rutaDelRol)) {
    const url = request.nextUrl.clone();
    url.pathname = rutaDelRol;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

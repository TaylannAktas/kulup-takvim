import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Next.js 16 proxy (eski adıyla middleware). Tüm uygulamayı - /api/* dahil -
 * varsayılan olarak kapalı tutar.
 *
 * Muaf tutulanlar:
 *  - /api/auth/*  : Auth.js'in kendi uçları (gate'lersek giriş kırılır)
 *  - /api/cron/*  : CRON_SECRET'i kendi route handler'ında doğrular, session'ı yoktur
 *  - /signin, /error : giriş ve hata sayfaları (aksi halde sonsuz yönlendirme)
 *
 * Bunlar dışında session yoksa:
 *  - /api/* istekleri  -> gövdesiz 401
 *  - diğer her şey     -> /signin adresine yönlendirme
 *
 * Not: proxy.ts'te `runtime` config export'u yoktur; Next.js 16'da proxy her
 * zaman Node.js runtime'ında çalışır.
 */

/** Session kontrolünden tamamen muaf yollar. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/cron" ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/signin" ||
    pathname === "/error"
  );
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (req.auth?.user) {
    return NextResponse.next();
  }

  // API istekleri: gövdesiz 401.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 401 });
  }

  // Sayfa gezinmeleri: giriş sayfasına yönlendir.
  const signInUrl = req.nextUrl.clone();
  signInUrl.pathname = "/signin";
  signInUrl.search = "";
  signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: [
    /*
     * Statik varlıklar dışında HER isteği yakala.
     * /api/* bilerek DIŞARIDA BIRAKILMAZ; muafiyetler yukarıdaki
     * isPublicPath() içinde açıkça tanımlıdır.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

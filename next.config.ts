import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // C:\Users\user içinde ilgisiz bir package-lock.json bulunuyor; Turbopack'in
  // workspace kökünü yanlış tespit edip bu projeyi C:\Users\user sanmasını
  // önlemek için kökü açıkça bu dizine sabitliyoruz.
  turbopack: {
    root: path.join(__dirname),
  },
  // Dev sunucusunda sayfa yenileme/geri gitme istemci bağlantısını yarıda
  // kesince Next'in gzip middleware'i zlib akışını kapatmıyor ve "drain"
  // dinleyicisi sızdırıyor (bkz. node_modules/next/dist/server/lib/
  // router-server.js — Next'in kendi yorumu: "leaks past GC"). localhost'ta
  // sıkıştırmanın faydası yok, kapatıp sızıntıyı kökten önlüyoruz.
  compress: false,
};

export default nextConfig;

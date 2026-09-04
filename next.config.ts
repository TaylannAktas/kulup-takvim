import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // C:\Users\user içinde ilgisiz bir package-lock.json bulunuyor; Turbopack'in
  // workspace kökünü yanlış tespit edip bu projeyi C:\Users\user sanmasını
  // önlemek için kökü açıkça bu dizine sabitliyoruz.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

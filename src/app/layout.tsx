import type { Metadata, Viewport } from "next";
import { Archivo_Black, Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const disp = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-disp", display: "swap" });
const body = Barlow({ weight: ["400", "500", "600", "700", "800"], subsets: ["latin"], variable: "--font-body", display: "swap" });
const num = Barlow_Condensed({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: "Remarcá",
  description: "Tus precios al día, en un toque. Sacale una foto a la lista del proveedor y Remarcá actualiza tus precios de venta.",
  applicationName: "Remarcá",
  appleWebApp: { capable: true, title: "Remarcá", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3E33C9" },
    { media: "(prefers-color-scheme: dark)", color: "#120F22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${disp.variable} ${body.variable} ${num.variable}`}>
      <body>{children}</body>
    </html>
  );
}

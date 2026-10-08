import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remarcá",
    short_name: "Remarcá",
    description: "Actualizá tus precios de venta a partir de la lista del proveedor.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F0FF",
    theme_color: "#3E33C9",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

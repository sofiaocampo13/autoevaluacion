import type { Metadata } from "next";
import { Figtree, Sora } from "next/font/google";
import "./globals.css";

// Sora para los títulos (geométrica, de aire tecnológico) y Figtree para el texto (cálida y muy legible).
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Autoevaluación académica",
  description: "Asistente de autoevaluación académica con IA para estudiantes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

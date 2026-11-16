"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

// Solo pantallas que existen. (Los mockups también traen «Evaluar laboratorio» y «Retroalimentación general», que no son
// pantallas aparte: la evaluación y su retroalimentación viven dentro de cada laboratorio.)
const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Inicio", icon: "inicio" },
  { href: "/laboratorios", label: "Mis laboratorios", icon: "labs" },
  { href: "/materiales", label: "Materiales de referencia", icon: "materiales" },
  { href: "/analisis", label: "Análisis del semestre", icon: "analisis" },
  { href: "/mapa", label: "Infografía general", icon: "infografia" },
  { href: "/informes", label: "Informes PDF", icon: "informes" },
  { href: "/historial", label: "Historial", icon: "historial" },
  { href: "/acerca", label: "Acerca del proyecto", icon: "acerca" },
];

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Inicio", icon: "inicio" },
  { href: "/laboratorios", label: "Labs", icon: "labs" },
  { href: "/materiales", label: "Materiales", icon: "materiales" },
  { href: "/analisis", label: "Semestre", icon: "analisis" },
  { href: "/informes", label: "Informes", icon: "informes" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

/** Menú lateral de escritorio (fondo ciruela). La sección actual lleva la píldora clara y `aria-current`. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-sm font-semibold transition-colors ${
              active ? "bg-[#F4EEFF] text-slate-900" : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon name={it.icon} className="h-[18px] w-[18px] shrink-0" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior de móvil: las cinco pantallas de uso diario. */
export function MobileTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-slate-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold ${active ? "bg-brand-50 text-brand-700" : "text-slate-600"}`}
          >
            <Icon name={t.icon} className="h-[22px] w-[22px]" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

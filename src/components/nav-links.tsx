"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Panel", icon: "panel" },
  { href: "/laboratorios", label: "Mis laboratorios", icon: "labs" },
  { href: "/analisis", label: "Análisis del semestre", icon: "analisis" },
  { href: "/mapa", label: "Mapa mental", icon: "mapa" },
  { href: "/materiales", label: "Materiales", icon: "materiales" },
  { href: "/perfil", label: "Mi perfil", icon: "perfil" },
  { href: "/acerca", label: "Acerca del proyecto", icon: "acerca" },
];

/** Menú principal con la sección actual marcada (también para lectores de pantalla con aria-current). */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 md:flex-col" aria-label="Principal">
      {ITEMS.map((it) => {
        const active = it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon name={it.icon} className="h-[18px] w-[18px] shrink-0" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

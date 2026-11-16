"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Selector «Iniciar sesión / Crear cuenta» del mockup de acceso: dos enlaces con aspecto de pestañas. No se muestra al recuperar la contraseña. */
export function AuthTabs() {
  const pathname = usePathname();
  if (pathname !== "/login" && pathname !== "/registro") return null;
  const tab = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-extrabold ${active ? "bg-white text-slate-800 shadow-[0_1px_3px_rgba(31,22,51,0.12)]" : "text-slate-600 hover:text-slate-800"}`}
      >
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Acceso" className="mb-6 flex rounded-full bg-slate-100 p-[5px]">
      {tab("/login", "Iniciar sesión")}
      {tab("/registro", "Crear cuenta")}
    </nav>
  );
}

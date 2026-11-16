import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileTabs, SidebarNav } from "@/components/nav-links";
import { logout } from "../(auth)/actions";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
  const name = profile?.full_name || data.user.email || "";
  const initials = initialsOf(name) || "?";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
      {/* Escritorio: menú lateral de 248 px. */}
      <aside className="hidden bg-slate-900 px-[18px] py-7 text-[#F4EEFF] md:sticky md:top-0 md:flex md:h-screen md:w-[248px] md:shrink-0 md:flex-col md:gap-7">
        <Link href="/" className="block px-2">
          <span className="flex flex-col">
            <span className="font-display text-[22px] font-semibold leading-none tracking-tight">Asesor pedagógico</span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#C9BEE0]">Autoevaluación IA</span>
          </span>
        </Link>
        <SidebarNav />
        <div className="mt-auto flex items-center gap-3 border-t border-plum-line px-2.5 py-3.5">
          <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-300 font-extrabold text-slate-900">{initials}</div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold" title={data.user.email ?? undefined}>{name}</span>
            <span className="flex items-center gap-1.5 text-xs text-[#C9BEE0]">
              <Link href="/perfil" className="hover:text-white hover:underline">Mi perfil</Link>
              <span aria-hidden="true">·</span>
              <form action={logout}>
                <button type="submit" className="hover:text-white hover:underline">Cerrar sesión</button>
              </form>
            </span>
          </div>
        </div>
      </aside>

      {/* Móvil: barra superior con la marca y tu perfil, y pestañas abajo. */}
      <header className="flex items-center justify-between px-5 pt-5 md:hidden">
        <Link href="/" className="block">
          <span className="font-display text-xl font-semibold tracking-tight text-slate-800">Asesor pedagógico</span>
        </Link>
        <Link href="/perfil" aria-label="Mi perfil" className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-300 font-extrabold text-slate-900">{initials}</Link>
      </header>

      <main className="min-w-0 flex-1 px-5 pb-28 pt-5 md:px-12 md:pb-12 md:pt-8">{children}</main>
      <MobileTabs />
    </div>
  );
}

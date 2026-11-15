import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();

  const link = "rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700";
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="border-b border-slate-200 bg-white p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
        <p className="mb-4 font-semibold text-indigo-700">Autoevaluación</p>
        <nav className="flex gap-1 md:flex-col" aria-label="Principal">
          <Link className={link} href="/">Panel</Link>
          <Link className={link} href="/laboratorios">Mis laboratorios</Link>
          <Link className={link} href="/materiales">Materiales</Link>
          <Link className={link} href="/perfil">Mi perfil</Link>
        </nav>
        <form action={logout} className="mt-4">
          <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" type="submit">
            Cerrar sesión
          </button>
        </form>
      </aside>
      <div className="flex-1 p-4 md:p-8">
        <p className="mb-6 text-sm text-slate-500">{profile?.full_name || data.user.email}</p>
        {children}
      </div>
    </div>
  );
}

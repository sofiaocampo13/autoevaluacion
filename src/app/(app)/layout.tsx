import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark, Icon } from "@/components/icons";
import { NavLinks } from "@/components/nav-links";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
  const name = profile?.full_name || data.user.email || "";

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="border-b border-slate-200 bg-white px-4 py-4 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:py-6">
        <Link href="/" className="mb-4 flex items-center gap-2.5 rounded-lg md:mb-8">
          <BrandMark />
          <span className="font-display text-[15px] font-semibold leading-tight text-slate-900">
            Asesor pedagógico
            <span className="block text-xs font-normal text-slate-500">Autoevaluación con IA</span>
          </span>
        </Link>
        <NavLinks />
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 md:mt-auto">
          <p className="min-w-0 truncate text-sm text-slate-600" title={data.user.email ?? undefined}>{name}</p>
          <form action={logout}>
            <button type="submit" className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              <Icon name="salir" className="h-[18px] w-[18px]" />
              <span>Salir</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">{children}</div>
      </div>
    </div>
  );
}

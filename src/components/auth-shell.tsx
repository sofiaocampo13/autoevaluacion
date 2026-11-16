/** Marco de acceso a pantalla completa (panel ciruela + tarjeta) para las páginas fuera del grupo (auth): confirmar correo y contraseña nueva. */
export function AuthShell({ tagline, children }: { tagline: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-wrap bg-slate-50 text-slate-800">
      <section className="flex flex-[1_1_420px] flex-col justify-between gap-10 bg-slate-900 p-[clamp(28px,5vw,64px)] text-[#F4EEFF]">
        <span className="font-display text-2xl font-semibold">Asesor pedagógico</span>
        <p className="max-w-[460px] font-display text-[clamp(30px,3.4vw,44px)] font-medium leading-[1.08]">{tagline}</p>
        <span className="text-xs text-[#C9BEE0]">Autoevaluación académica con IA</span>
      </section>
      <section className="flex flex-[1_1_420px] items-center justify-center p-[clamp(24px,5vw,64px)]">
        <div className="w-full max-w-[440px] rounded-[28px] border border-slate-200 bg-white px-[clamp(22px,3vw,40px)] py-9">{children}</div>
      </section>
    </main>
  );
}

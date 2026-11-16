/** Marco común de las páginas «no encontrada» y «error»: marca, cifra grande, título, texto y acciones. */
export const linkPrimary =
  "inline-flex min-h-[50px] items-center rounded-full bg-brand-600 px-6 text-sm font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";
export const linkSecondary =
  "inline-flex min-h-[50px] items-center rounded-full border-[1.5px] border-brand-600 bg-white px-6 text-sm font-extrabold text-brand-600 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";

export function ErrorPageShell({
  mark,
  markClass,
  title,
  description,
  children,
}: {
  mark: string;
  markClass: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <div className="px-[clamp(16px,4vw,48px)] py-6">
        <span className="font-display text-[22px] font-semibold">Asesor pedagógico</span>
      </div>
      <main className="flex flex-1 items-center justify-center px-[clamp(16px,4vw,48px)] pb-16 pt-6">
        <div className="flex max-w-[620px] flex-col items-start gap-[18px]">
          <span aria-hidden="true" className={`font-display text-[clamp(88px,12vw,140px)] leading-[0.9] ${markClass}`}>{mark}</span>
          <h1 className="font-display text-[40px] font-medium leading-[1.1]">{title}</h1>
          <p className="text-[17px] leading-relaxed text-slate-600">{description}</p>
          <div className="flex flex-wrap gap-3">{children}</div>
        </div>
      </main>
    </div>
  );
}

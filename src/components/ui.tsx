import { Icon } from "./icons";

/** Aviso de formulario: error (rosado), éxito real (verde) o informativo (azul). */
export function Notice({ error, ok, info }: { error?: string; ok?: string; info?: string }) {
  const text = error ?? ok ?? info;
  if (!text) return null;
  const cls = error
    ? "bg-pink-50 text-pink-900"
    : ok
      ? "bg-emerald-50 text-emerald-800"
      : "bg-blue-50 text-blue-900";
  return (
    <p role={error ? "alert" : "status"} className={`mb-4 rounded-2xl px-4 py-3 text-sm leading-relaxed ${cls}`}>
      {text}
    </p>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="mb-4 flex flex-col gap-1.5 text-[13px] font-bold text-slate-800">
      {label}
      <input
        {...rest}
        className="min-h-12 rounded-[14px] border-[1.5px] border-slate-300 bg-white px-3.5 text-[15px] font-normal text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-brand-600 px-5 text-[15px] font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}

/** Aviso informativo breve (p. ej. «estimación orientativa»): azul, con icono, siempre con el mismo aspecto. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900 ring-1 ring-blue-100">
      <Icon name="info" className="mt-px h-4 w-4 shrink-0 text-blue-700" />
      <span>{children}</span>
    </p>
  );
}

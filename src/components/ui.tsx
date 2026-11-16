export function Notice({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  const cls = error ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <p role={error ? "alert" : "status"} className={`mb-4 rounded-lg px-3 py-2 text-sm ring-1 ${cls}`}>
      {error ?? ok}
    </p>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="mb-4 block text-sm font-medium text-slate-700">
      {label}
      <input
        {...rest}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
    >
      {children}
    </button>
  );
}

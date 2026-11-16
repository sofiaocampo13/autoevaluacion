export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-brand-700">Autoevaluación académica</h1>
        <p className="mb-6 text-sm text-slate-500">Asistente de aprendizaje con IA</p>
        {children}
      </div>
    </main>
  );
}

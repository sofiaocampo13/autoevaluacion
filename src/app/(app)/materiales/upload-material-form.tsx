"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFile } from "@/lib/upload-client";
import { ACCEPT_ATTR, CATEGORIES, CATEGORY_LABELS, FILE_TYPES, extOf, type Category } from "@/lib/files";
import { addMaterial } from "./actions";

export function UploadMaterialForm({ labs }: { labs: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string; hint?: string }>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File;
    if (!file || !file.name) return setMsg({ error: "Elige un archivo." });

    setBusy(true);
    setMsg({});
    const up = await uploadFile(file, "materiales");
    if (!up.ok) {
      setBusy(false);
      return setMsg({ error: up.error });
    }
    const res = await addMaterial({
      path: up.path,
      title: String(fd.get("title") || file.name.replace(/\.[^.]+$/, "")),
      category: String(fd.get("category")) as Category,
      version: String(fd.get("version") || "1"),
      labId: (fd.get("labId") as string) || null,
    });
    setBusy(false);
    if (!res.ok) return setMsg({ error: res.error });
    setMsg({ ok: res.message ?? "Material guardado.", hint: FILE_TYPES[extOf(file.name)]?.hint });
    formRef.current?.reset();
    router.refresh();
  }

  const input = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900";
  return (
    <form ref={formRef} onSubmit={onSubmit} className="mb-8 max-w-xl rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 className="mb-4 font-medium">Agregar material</h2>
      {msg.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
      {msg.ok && (
        <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {msg.ok} {msg.hint}
        </p>
      )}
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Archivo (máx. 50 MB)
        <input name="file" type="file" accept={ACCEPT_ATTR} required className={input} />
      </label>
      <label className="mb-3 block text-sm font-medium text-slate-700">
        Título (opcional)
        <input name="title" maxLength={200} className={input} />
      </label>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Categoría
          <select name="category" className={input}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Versión
          <input name="version" defaultValue="1" maxLength={30} className={input} />
        </label>
      </div>
      <label className="mb-4 block text-sm font-medium text-slate-700">
        Laboratorio asociado (opcional)
        <select name="labId" className={input} defaultValue="">
          <option value="">Ninguno</option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Una guía o rúbrica se asigna como la de ese laboratorio. Los demás materiales se usan como contexto al evaluarlo.
        </span>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? "Subiendo…" : "Subir material"}
      </button>
    </form>
  );
}

"use client";

import { uploadFile } from "@/lib/upload-client";
import { FILE_TYPES, extOf } from "@/lib/files";
import { addLabFiles } from "@/app/(app)/laboratorios/actions";

const CONCURRENCY = 4;
const BATCH = 25;

export type UploadItem = { file: File; relativePath: string };
export type UploadReport = { uploaded: number; problems: { name: string; reason: string }[]; hints: string[] };

/** Sube los archivos en paralelo directo a Storage y los registra por lotes en el laboratorio. */
export async function uploadToLab(
  labId: string,
  items: UploadItem[],
  onFileDone?: () => void,
): Promise<UploadReport> {
  const problems: UploadReport["problems"] = [];
  const hints = new Set<string>();
  const uploaded: { path: string; item: UploadItem }[] = [];

  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      const up = await uploadFile(item.file, `labs/${labId}`);
      if (up.ok) {
        uploaded.push({ path: up.path, item });
        const hint = FILE_TYPES[extOf(item.file.name)]?.hint;
        if (hint) hints.add(hint);
      } else problems.push({ name: item.relativePath, reason: up.error });
      onFileDone?.();
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));

  let registered = 0;
  for (let i = 0; i < uploaded.length; i += BATCH) {
    const chunk = uploaded.slice(i, i + BATCH);
    const res = await addLabFiles({
      labId,
      items: chunk.map((c) => ({
        path: c.path,
        fileName: c.item.file.name,
        relativePath: c.item.relativePath === c.item.file.name ? "" : c.item.relativePath,
      })),
    });
    if ("error" in res) chunk.forEach((c) => problems.push({ name: c.item.relativePath, reason: res.error }));
    else {
      registered += chunk.length - res.failed.length;
      res.failed.forEach((f) => problems.push({ name: f.fileName, reason: f.error }));
    }
  }
  return { uploaded: registered, problems, hints: [...hints] };
}

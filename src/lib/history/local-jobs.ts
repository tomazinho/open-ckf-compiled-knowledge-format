// Local job history (replaces Supabase compiler_jobs).
import type { CompileResult } from "@/lib/compiler/compile-client";

const KEY = "openckf.jobs.v1";
const MAX_JOBS = 50;

export type StoredJob = {
  id: string;
  createdAt: string;
  filename?: string;
  provider: string;
  model: string;
  sourceChars: number;
  sourceSha256: string;
  warnings: string[];
  metrics: CompileResult["metrics"];
  pkgMd: string;
  pkg: CompileResult["pkg"];
};

function migrateLegacy() {
  if (typeof window === "undefined") return;
  const legacy = window.localStorage.getItem("openkcp.jobs.v1");
  if (legacy && !window.localStorage.getItem(KEY)) {
    window.localStorage.setItem(KEY, legacy);
    window.localStorage.removeItem("openkcp.jobs.v1");
  }
}

function read(): StoredJob[] {
  if (typeof window === "undefined") return [];
  migrateLegacy();
  try { const raw = window.localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as StoredJob[]) : []; }
  catch { return []; }
}
function write(jobs: StoredJob[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, MAX_JOBS)));
}

export function listJobs(): StoredJob[] { return read(); }
export function getJob(id: string): StoredJob | undefined { return read().find((j) => j.id === id); }

export function saveJob(r: CompileResult): StoredJob {
  const job: StoredJob = {
    id: r.jobId, createdAt: new Date().toISOString(),
    filename: r.filename, provider: r.provider, model: r.model,
    sourceChars: r.sourceChars, sourceSha256: r.sourceSha256,
    warnings: r.warnings, metrics: r.metrics,
    pkgMd: r.pkgMd, pkg: r.pkg,
  };
  const jobs = [job, ...read().filter((j) => j.id !== job.id)];
  write(jobs);
  return job;
}

export function deleteJob(id: string) { write(read().filter((j) => j.id !== id)); }
export function clearJobs() { write([]); }

export function exportJobs(): string {
  return JSON.stringify({ schema: "openckf.jobs.v1", exportedAt: new Date().toISOString(), jobs: read() }, null, 2);
}

export function importJobs(text: string): { added: number } {
  const data = JSON.parse(text);
  const incoming: StoredJob[] = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : [];
  if (!incoming.length) return { added: 0 };
  const existing = read();
  const byId = new Map(existing.map((j) => [j.id, j] as const));
  let added = 0;
  for (const j of incoming) { if (!byId.has(j.id)) { byId.set(j.id, j); added++; } }
  const merged = [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  write(merged);
  return { added };
}

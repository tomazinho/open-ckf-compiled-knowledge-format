// Shared client-side helpers used by the Pro and Demo compiler pages.

/** Random short id for in-memory source-file rows. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Strip WebVTT / SRT timecodes and cue numbers, keep spoken text only. */
export function normalizeTranscript(raw: string, name: string): string {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".vtt") && !lower.endsWith(".srt")) return raw;
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (/^WEBVTT/i.test(t)) continue;
    if (/^\d+$/.test(t)) continue; // SRT cue index
    if (/-->/i.test(t)) continue; // timecode line
    if (/^(NOTE|STYLE|REGION)\b/i.test(t)) continue;
    out.push(t.replace(/<[^>]+>/g, "")); // strip inline VTT tags
  }
  return out.join("\n").trim();
}

/** Copy text to clipboard (no toast — caller decides UX). */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/** Trigger a browser download for the given text payload. */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

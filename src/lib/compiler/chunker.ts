export type Chunk = { id: string; path: string; text: string; charStart: number; charEnd: number };

const APPROX_CHARS_PER_CHUNK = 12_000;

export function chunkSemantically(rawText: string): Chunk[] {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const sections = splitByHeadings(text);
  const chunks: Chunk[] = [];
  let cursor = 0; let id = 0;
  for (const sec of sections) {
    if (sec.text.length <= APPROX_CHARS_PER_CHUNK) {
      chunks.push({ id: `c${id++}`, path: sec.path, text: sec.text, charStart: cursor, charEnd: cursor + sec.text.length });
      cursor += sec.text.length; continue;
    }
    const paragraphs = sec.text.split(/\n\n+/);
    let buf = "";
    for (const p of paragraphs) {
      if ((buf + "\n\n" + p).length > APPROX_CHARS_PER_CHUNK && buf) {
        chunks.push({ id: `c${id++}`, path: sec.path, text: buf, charStart: cursor, charEnd: cursor + buf.length });
        cursor += buf.length; buf = p;
      } else { buf = buf ? buf + "\n\n" + p : p; }
    }
    if (buf) { chunks.push({ id: `c${id++}`, path: sec.path, text: buf, charStart: cursor, charEnd: cursor + buf.length }); cursor += buf.length; }
  }
  return chunks;
}

function splitByHeadings(text: string) {
  const lines = text.split("\n");
  const sections: { path: string; text: string }[] = [];
  let currentTitles: string[] = ["root"];
  let currentLines: string[] = [];
  const flush = () => { const body = currentLines.join("\n").trim(); if (body) sections.push({ path: currentTitles.join(" > "), text: body }); };
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const depth = heading[1].length;
      currentTitles = currentTitles.slice(0, depth);
      while (currentTitles.length < depth - 1) currentTitles.push("…");
      currentTitles.push(heading[2].trim());
      currentLines = [line];
    } else { currentLines.push(line); }
  }
  flush();
  return sections.length ? sections : [{ path: "document", text }];
}

export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

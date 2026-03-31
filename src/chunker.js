// chunker.js — Troceado de sesiones JSONL y archivos Markdown
// Fiel al artículo: 1500 chars max, 200 chars de overlap

const MAX_CHUNK_CHARS = 1500;
const OVERLAP_CHARS = 200;

/**
 * Trocea una sesión JSONL de OpenClaw.
 * Filtra tool calls y mensajes de sistema (son ruido).
 * Solo conserva user y assistant con contenido real.
 */
export function chunkSession(messages, sessionKey) {
  const chunks = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const msg of messages) {
    // Solo user y assistant con contenido real
    if (msg.role === "tool" || !msg.content) continue;
    if (msg.role === "system") continue;

    const line = `[${msg.role}]: ${msg.content.slice(0, 800)}\n`;

    if (currentChunk.length + line.length > MAX_CHUNK_CHARS && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        sessionKey,
      });
      // Overlap para mantener contexto entre chunks
      const overlap = currentChunk.slice(-OVERLAP_CHARS);
      currentChunk = overlap + line;
    } else {
      currentChunk += line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      sessionKey,
    });
  }

  return chunks;
}

/**
 * Trocea un archivo Markdown por secciones ##
 * Si una sección es muy larga, se parte con overlap.
 */
export function chunkMarkdown(text, sourcePath) {
  const sections = text.split(/^(?=## )/m);
  const chunks = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (!section.trim()) continue;

    if (section.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        content: section.trim(),
        index: chunkIndex++,
        sourcePath,
      });
    } else {
      // Sección muy larga: partir con overlap
      const subChunks = splitWithOverlap(section, MAX_CHUNK_CHARS, OVERLAP_CHARS);
      for (const sub of subChunks) {
        chunks.push({
          content: sub.trim(),
          index: chunkIndex++,
          sourcePath,
        });
      }
    }
  }

  return chunks;
}

/**
 * Divide texto largo en partes con overlap
 */
function splitWithOverlap(text, maxChars, overlapChars) {
  const parts = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    parts.push(text.slice(start, end));

    if (end >= text.length) break;
    start = end - overlapChars;
  }

  return parts;
}

/**
 * Estima tokens (~4 chars por token en español)
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

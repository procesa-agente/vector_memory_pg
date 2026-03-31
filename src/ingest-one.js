// ingest-one.js — Ingesta de un solo archivo
// Equivale a ingest-one.ts del artículo.
// Cada invocación: comprueba mtime → trocea → embebe → guarda → sale.

import { readFile, stat } from "fs/promises";
import { basename, extname } from "path";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import {
  initDb,
  insertMemory,
  deleteBySource,
  getIngestLog,
  upsertIngestLog,
} from "./db.js";
import { embedBatch } from "./embeddings.js";
import { chunkSession, chunkMarkdown, estimateTokens } from "./chunker.js";
import pool from "./db.js";

dotenv.config();

async function ingestOne() {
  const filePath = process.argv[2];
  const sourceType = process.argv[3] || "session"; // session | daily | memory | brain

  if (!filePath) {
    console.error("Uso: node src/ingest-one.js <archivo> <tipo>");
    process.exit(1);
  }

  try {
    await initDb();

    // Comprobar si el archivo cambió (por mtime, como en el artículo)
    const fileStat = await stat(filePath);
    const mtime = fileStat.mtime.toISOString();

    const log = await getIngestLog(filePath);
    if (log && log.last_modified === mtime) {
      console.log("SKIP");
      await pool.end();
      return;
    }

    // Leer y trocear
    const content = await readFile(filePath, "utf-8");
    let chunks;

    if (extname(filePath) === ".jsonl") {
      // Sesión JSONL de OpenClaw
      const messages = content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const sessionKey = basename(filePath, ".jsonl");
      chunks = chunkSession(messages, sessionKey);
    } else {
      // Archivo Markdown (.md)
      chunks = chunkMarkdown(content, filePath);
    }

    if (chunks.length === 0) {
      console.log("SKIP:empty");
      await pool.end();
      return;
    }

    // Eliminar chunks anteriores de este archivo
    await deleteBySource(filePath);

    // Generar embeddings en batch
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedBatch(texts);

    // Guardar en PostgreSQL
    const createdAt = fileStat.mtime.toISOString();

    for (let i = 0; i < chunks.length; i++) {
      await insertMemory({
        id: `${basename(filePath)}_chunk_${i}_${randomUUID().slice(0, 8)}`,
        content: chunks[i].content,
        sourceType,
        sourcePath: filePath,
        sessionKey: chunks[i].sessionKey || null,
        createdAt,
        chunkIndex: chunks[i].index,
        tokenCount: estimateTokens(chunks[i].content),
        embedding: embeddings[i],
      });
    }

    // Actualizar ingest_log
    await upsertIngestLog(filePath, mtime, chunks.length);

    console.log(`OK:${chunks.length} chunks`);
    await pool.end();
  } catch (err) {
    console.error(`ERROR:${err.message}`);
    await pool.end();
    process.exit(1);
  }
}

ingestOne();

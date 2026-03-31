// mcp-server.js — Servidor MCP para memoria vectorial
// Expone search_memories, recent_memories e ingest_file como herramientas MCP
// Comunicación: stdio (JSON-RPC 2.0), compatible con Claude Code y OpenClaw

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Cargar .env desde la raíz del proyecto
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

import { initDb, getStats } from "./db.js";
import { searchMemories, recentMemories } from "./query.js";
import pool from "./db.js";

// --- Inicializar servidor MCP ---

const server = new McpServer({
  name: "vector-memory",
  version: "1.0.0",
});

// --- Herramienta: search_memories ---

server.tool(
  "search_memories",
  "Busca memorias relevantes por similitud semántica en el historial de sesiones, notas diarias y documentos técnicos de Karai.",
  {
    query: z.string().describe("Texto de búsqueda en lenguaje natural"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Número máximo de resultados (default: 5)"),
    types: z
      .array(z.enum(["session", "daily", "memory", "docs"]))
      .optional()
      .describe(
        "Filtrar por tipo: session, daily, memory, docs. Si se omite, busca en todos."
      ),
  },
  async ({ query, limit, types }) => {
    const results = await searchMemories(query, { limit, types });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No se encontraron memorias relevantes para: "${query}"`,
          },
        ],
      };
    }

    const formatted = results
      .map(
        (r, i) =>
          `[${i + 1}] Score: ${r.score} | Tipo: ${r.source_type} | Fecha: ${r.created_at?.slice(0, 10)}\n${r.content}`
      )
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text",
          text: `${results.length} resultado(s) para "${query}":\n\n${formatted}`,
        },
      ],
    };
  }
);

// --- Herramienta: recent_memories ---

server.tool(
  "recent_memories",
  "Obtiene las memorias más recientes sin búsqueda semántica. Útil para ver qué se trabajó últimamente.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Número máximo de resultados (default: 5)"),
    types: z
      .array(z.enum(["session", "daily", "memory", "docs"]))
      .optional()
      .describe("Filtrar por tipo. Si se omite, devuelve todos los tipos."),
  },
  async ({ limit, types }) => {
    const results = await recentMemories({ limit, types });

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No hay memorias recientes." }],
      };
    }

    const formatted = results
      .map(
        (r, i) =>
          `[${i + 1}] Tipo: ${r.source_type} | Fecha: ${r.created_at?.slice(0, 10)}\n${r.content.slice(0, 300)}...`
      )
      .join("\n\n---\n\n");

    return {
      content: [{ type: "text", text: formatted }],
    };
  }
);

// --- Herramienta: memory_stats ---

server.tool(
  "memory_stats",
  "Devuelve estadísticas de la memoria vectorial: total de chunks, distribución por tipo y tamaño de la DB.",
  {},
  async () => {
    const stats = await getStats();
    const text = [
      `Total chunks: ${stats.total_chunks}`,
      `Con embeddings: ${stats.with_embeddings}`,
      `Tamaño DB: ${stats.db_size}`,
      `Por tipo: ${JSON.stringify(stats.by_type, null, 2)}`,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
    };
  }
);

// --- Arrancar servidor ---

async function main() {
  await initDb();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP usa stdio — no loguear a stdout para no corromper el protocolo
  process.stderr.write("[MCP] vector-memory server iniciado\n");

  process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[MCP] Error fatal: ${err.message}\n`);
  process.exit(1);
});

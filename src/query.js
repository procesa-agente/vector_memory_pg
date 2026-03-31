// query.js — Interfaz de búsqueda
// Equivale a queryMemories() del artículo, pero el coseno lo hace PostgreSQL

import { embedOne } from "./embeddings.js";
import { queryByEmbedding, getRecent } from "./db.js";

/**
 * Busca memorias por similitud semántica.
 *
 * En el artículo original:
 *   1. Carga TODOS los BLOBs de SQLite
 *   2. Reconstruye Float32Array para cada fila
 *   3. Calcula coseno en un loop JS
 *   4. Ordena y devuelve top N
 *   → Con 7.000 chunks: ~15ms
 *
 * En nuestra versión PostgreSQL:
 *   1. Genera embedding de la query con OpenAI
 *   2. PostgreSQL usa el índice HNSW para encontrar los vecinos más cercanos
 *   3. Devuelve top N con score de similitud
 *   → Sin importar cuántos chunks: <5ms (HNSW es sublineal)
 */
export async function searchMemories(queryText, options = {}) {
  const limit = options.limit || 5;
  const types = options.types || null;

  // Embeber la query
  const queryEmbedding = await embedOne(queryText);

  // Buscar en PostgreSQL (coseno nativo con operador <=>)
  const rows = await queryByEmbedding(queryEmbedding, { limit, types });

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    source_type: row.source_type,
    source_path: row.source_path,
    session_key: row.session_key,
    created_at: row.created_at,
    score: parseFloat(row.similarity?.toFixed(4)),
    metadata: row.metadata,
  }));
}

/**
 * Obtiene memorias recientes (sin búsqueda semántica)
 */
export async function recentMemories(options = {}) {
  const rows = await getRecent(options);

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    source_type: row.source_type,
    source_path: row.source_path,
    created_at: row.created_at,
  }));
}

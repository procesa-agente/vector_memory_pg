# Changelog

## [1.0.0] - 2026-03-31

### Agregado
- Servidor MCP (`mcp-server.js`) con herramientas `search_memories`, `recent_memories`, `memory_stats`
- Soporte para tipos de memoria: `session`, `daily`, `memory`, `docs`
- Ingesta incremental por `mtime` via `ingest.sh` + `ingest-one.js`
- HTTP API en puerto 3010: `/query`, `/recent`, `/stats`, `/ingest`

### Cambiado
- Motor de embeddings: Gemini `gemini-embedding-001` (768 dims) → OpenAI `text-embedding-3-small` (1536 dims)
- Base de datos: SQLite + fuerza bruta JS → PostgreSQL + pgvector con índice HNSW

### Base
- Adaptado del tutorial de [Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial)

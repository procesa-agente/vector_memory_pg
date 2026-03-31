# 🧠 Memoria Vectorial para Agente IA — PostgreSQL Edition

Adaptación del tutorial de [Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial) que usa SQLite + coseno por fuerza bruta en JS. Esta versión reemplaza SQLite por **PostgreSQL + pgvector**, delegando la búsqueda por coseno al motor de base de datos con un índice HNSW.

Incluye además un **servidor MCP** para integrarse directamente con Claude Code y otros agentes compatibles con el protocolo MCP.

## Qué cambió vs. el artículo original

| Componente | Artículo (SQLite) | Esta versión (PostgreSQL) |
|---|---|---|
| Base de datos | `better-sqlite3` | `pg` (node-postgres) |
| Almacenamiento de vectores | BLOBs (`Float32Array → Buffer`) | Tipo nativo `vector(768)` |
| Búsqueda por coseno | Fuerza bruta en JS (loop sobre todos los BLOBs) | Operador `<=>` con índice HNSW |
| Escalabilidad | ~50K chunks, luego necesita sqlite-vec | Millones de chunks con HNSW |
| Concurrencia | SQLite locks (un writer a la vez) | MVCC nativo de PostgreSQL |
| Modelo de embeddings | `gemini-embedding-001` (768 dims) | `text-embedding-3-small` (1536 dims) |
| Chunking | 1500 chars, 200 overlap | Igual |
| Server HTTP | Puerto 3010, Node.js puro | Igual |
| Ingesta incremental | `mtime` en `ingest_log` | Igual |
| Integración MCP | No incluida | ✅ `mcp-server.js` listo para usar |

### Lo que se mantiene idéntico

- Mismos 4 endpoints HTTP: `/query`, `/recent`, `/stats`, `/ingest`
- Mismo chunker: sesiones JSONL (filtra tool calls) + Markdown (por secciones `##`)
- Misma estrategia de ingesta incremental (un proceso por archivo, compara `mtime`)
- Mismo chunker y estrategia de ingesta incremental

### Lo que mejora

- **Búsqueda**: de O(n) fuerza bruta a O(log n) con HNSW. No importa si tenés 7K o 700K chunks.
- **Concurrencia**: múltiples lectores y writers simultáneos (MVCC).
- **MCP nativo**: expone `search_memories`, `recent_memories` y `memory_stats` como herramientas MCP.
- **Ya tenés PostgreSQL**: en tu servidor con PostGIS, solo agregás pgvector.

## Arquitectura

```
Sesiones JSONL + archivos .md
        │
        ▼
    Chunker ──────── 1500 chars, 200 overlap
        │
        ▼
    OpenAI API ───── text-embedding-3-small, 1536 dims
        │
        ▼
    PostgreSQL ───── vector(768) + índice HNSW
        │
        ├── Server HTTP ──── Puerto 3010, búsqueda con operador <=>
        └── MCP Server ───── stdio, compatible con Claude Code / OpenClaw
```

## Requisitos

- **Node.js** 18+
- **PostgreSQL** 14+ con **pgvector** instalado
- **OpenAI API Key** con acceso a `text-embedding-3-small`

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y GEMINI_API_KEY

# 3. Crear schema (tablas + índice HNSW)
npm run setup

# 4. Indexar sesiones y memoria
chmod +x ingest.sh
./ingest.sh

# 5. Arrancar el servidor HTTP
npm run server

# 5b. O arrancar el servidor MCP (para Claude Code / OpenClaw)
npm run mcp
```

## Uso — HTTP API

```bash
# Búsqueda semántica
curl "http://localhost:3010/query?q=configuración+de+mi+agente&limit=3"

# Memorias recientes
curl "http://localhost:3010/recent?limit=5&types=session"

# Estadísticas
curl "http://localhost:3010/stats"

# Ingesta manual de un archivo
curl -X POST http://localhost:3010/ingest \
  -H "Content-Type: application/json" \
  -d '{"path": "/ruta/a/sesion.jsonl", "type": "session"}'
```

## Uso — MCP (Claude Code / OpenClaw)

Agregar al `mcp.json` de Claude Code o al `openclaw.json`:

```json
{
  "mcpServers": {
    "vector-memory": {
      "command": "node",
      "args": ["/ruta/a/vector_memory_pg/src/mcp-server.js"],
      "cwd": "/ruta/a/vector_memory_pg"
    }
  }
}
```

Herramientas disponibles via MCP:

| Herramienta | Descripción |
|---|---|
| `search_memories` | Búsqueda semántica por texto libre |
| `recent_memories` | Memorias más recientes sin búsqueda |
| `memory_stats` | Total de chunks, tamaño DB, distribución por tipo |

Tipos de memoria soportados: `session`, `daily`, `memory`, `docs`

## Ingesta automática (cron)

```bash
# Agregar a crontab -e — cada hora
0 * * * * cd /ruta/a/vector_memory_pg && ./ingest.sh >> /var/log/vector-memory-ingest.log 2>&1
```

## Estructura

```
vector-memory-pg/
├── src/
│   ├── mcp-server.js  — Servidor MCP (search_memories, recent_memories, memory_stats)
│   ├── server.js      — HTTP API en puerto 3010
│   ├── ingest-one.js  — Ingesta incremental de un archivo
│   ├── embeddings.js  — API de Gemini (batch de 100)
│   ├── chunker.js     — Troceado de sesiones JSONL y markdown
│   ├── db.js          — PostgreSQL + pgvector (pool, queries, coseno HNSW)
│   ├── query.js       — Búsqueda semántica
│   └── setup-db.js    — Inicialización del schema
├── sql/
│   └── schema.sql     — DDL: tablas, índice HNSW
├── ingest.sh          — Script bash para ingesta incremental
├── .env.example       — Variables de entorno requeridas
└── package.json
```

## Dependencias

```json
{
  "@modelcontextprotocol/sdk": "^1.28.0",
  "dotenv": "^16.4.0",
  "pg": "^8.13.0",
  "zod": "^3.x"
}
```

> No se usa el SDK oficial de OpenAI — los embeddings se generan con `fetch` nativo para mantener las dependencias mínimas.

## Créditos

Basado en el artículo de [Carlos Azaustre](https://carlosazaustre.es/blog/memoria-vectorial-openclaw-tutorial).

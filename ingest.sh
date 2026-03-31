#!/bin/bash
# ingest.sh — Script de ingesta incremental
# Fiel al artículo: un proceso Node.js por archivo para no reventar la RAM.
# Cada proceso arranca, procesa un archivo, y se cierra.

set -euo pipefail

# Cargar variables de entorno
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SESSIONS="${SESSIONS_DIR:-/home/openclaw/.openclaw/agents/main/sessions}"
MEMORY_DIR="${MEMORY_DIR:-/home/openclaw/.openclaw/workspace/memory}"
MEMORY_FILE="${MEMORY_FILE:-/home/openclaw/.openclaw/workspace/MEMORY.md}"
DOCS_DIR="${DOCS_DIR:-/home/openclaw/.openclaw/workspace/docs}"

INGESTED=0
SKIPPED=0
ERRORS=0

echo "=== Ingesta de memoria vectorial (PostgreSQL) ==="
echo "Sesiones: $SESSIONS"
echo "Memoria:  $MEMORY_DIR"
echo ""

# 1. Sesiones JSONL
if [ -d "$SESSIONS" ]; then
  echo "--- Procesando sesiones JSONL ---"
  for f in "$SESSIONS"/*.jsonl; do
    [ -f "$f" ] || continue
    RESULT=$(node src/ingest-one.js "$f" session 2>&1) || true
    case "$RESULT" in
      OK:*)   echo "  ✅ $(basename "$f"): $RESULT"; INGESTED=$((INGESTED+1)) ;;
      SKIP*)  SKIPPED=$((SKIPPED+1)) ;;
      *)      echo "  ❌ $(basename "$f"): $RESULT"; ERRORS=$((ERRORS+1)) ;;
    esac
  done
fi

# 2. Notas diarias (memory/*.md)
if [ -d "$MEMORY_DIR" ]; then
  echo "--- Procesando notas diarias ---"
  find "$MEMORY_DIR" -name "*.md" -type f | while read -r f; do
    RESULT=$(node src/ingest-one.js "$f" daily 2>&1) || true
    case "$RESULT" in
      OK:*)   echo "  ✅ $(basename "$f"): $RESULT"; INGESTED=$((INGESTED+1)) ;;
      SKIP*)  SKIPPED=$((SKIPPED+1)) ;;
      *)      echo "  ❌ $(basename "$f"): $RESULT"; ERRORS=$((ERRORS+1)) ;;
    esac
  done
fi

# 3. MEMORY.md (memoria de largo plazo)
if [ -f "$MEMORY_FILE" ]; then
  echo "--- Procesando MEMORY.md ---"
  RESULT=$(node src/ingest-one.js "$MEMORY_FILE" memory 2>&1) || true
  case "$RESULT" in
    OK:*)   echo "  ✅ MEMORY.md: $RESULT"; INGESTED=$((INGESTED+1)) ;;
    SKIP*)  SKIPPED=$((SKIPPED+1)) ;;
    *)      echo "  ❌ MEMORY.md: $RESULT"; ERRORS=$((ERRORS+1)) ;;
  esac
fi

# 4. Docs técnicos (docs/*.md)
if [ -d "$DOCS_DIR" ]; then
  echo "--- Procesando docs técnicos ---"
  find "$DOCS_DIR" -name "*.md" -type f | while read -r f; do
    RESULT=$(node src/ingest-one.js "$f" docs 2>&1) || true
    case "$RESULT" in
      OK:*)   echo "  ✅ $(basename "$f"): $RESULT"; INGESTED=$((INGESTED+1)) ;;
      SKIP*)  SKIPPED=$((SKIPPED+1)) ;;
      *)      echo "  ❌ $(basename "$f"): $RESULT"; ERRORS=$((ERRORS+1)) ;;
    esac
  done
fi

echo ""
echo "=== Resumen ==="
echo "Ingested: $INGESTED"
echo "Skipped:  $SKIPPED"
echo "Errors:   $ERRORS"

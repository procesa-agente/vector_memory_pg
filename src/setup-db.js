// setup-db.js — Inicializa PostgreSQL con el schema
import dotenv from "dotenv";
import { initDb } from "./db.js";
import pool from "./db.js";

dotenv.config();

async function setup() {
  console.log("[Setup] Conectando a PostgreSQL...");

  try {
    await initDb();
    const stats = await pool.query(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
    );
    console.log("[Setup] ✅ Schema creado exitosamente");
    console.log("[Setup] Tablas: memories, ingest_log");
    console.log("[Setup] Índice: HNSW sobre vector(768)");
    console.log(`[Setup] DB size: ${stats.rows[0].size}`);
  } catch (err) {
    console.error("[Setup] ❌ Error:", err.message);
    if (err.message.includes("vector")) {
      console.error("\n  pgvector no está instalado. Instalá con:");
      console.error("  sudo apt install postgresql-17-pgvector");
      console.error("  O en DigitalOcean managed DB ya viene incluido.\n");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();

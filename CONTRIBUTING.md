# Contribuir a vector-memory-pg

¡Gracias por tu interés! Este proyecto acepta contribuciones de cualquier tipo: bugs, features, docs, tests.

## Reportar un bug

Usá el template de issue "Bug Report". Incluí:
- Versión de Node.js y PostgreSQL
- Versión de pgvector (`SELECT extversion FROM pg_extension WHERE extname = 'vector'`)
- El error exacto (logs completos)
- Pasos para reproducirlo

## Proponer una feature

Abrí un issue con el template "Feature Request" antes de escribir código. Así evitamos trabajo duplicado.

## Abrir un Pull Request

1. Forkear el repo
2. Crear una rama desde `main`: `git checkout -b feature/mi-feature`
3. Hacer los cambios
4. Verificar que el servidor HTTP y MCP arrancan sin errores:
   ```bash
   npm run setup
   npm run server
   npm run mcp
   ```
5. Abrir el PR con descripción clara de qué cambia y por qué

## Estilo de código

- ES Modules (`import/export`), no CommonJS
- Sin dependencias nuevas sin discutirlo en el issue primero
- JSDoc en funciones públicas
- Sin `console.log` en código de producción (usar `process.stderr.write` para logs internos)

## Preguntas

Abrí un issue con el label `question`.

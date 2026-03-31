// embeddings.js — OpenAI text-embedding-3-small
// Reemplaza Gemini — usamos OpenAI text-embedding-3-small (1536 dims)
// Modelo: text-embedding-3-small, 1536 dimensiones, batch de 100

const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const BATCH_SIZE = 100;

/**
 * Genera embeddings en batch usando OpenAI.
 * La API acepta hasta 2048 inputs por request, usamos 100 por consistencia.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const allResults = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI embed error (${response.status}): ${err}`);
    }

    const data = await response.json();

    // OpenAI devuelve data.data[].embedding (float[] de 1536 dims)
    for (const item of data.data) {
      allResults.push(item.embedding);
    }
  }

  return allResults;
}

/**
 * Genera embedding para un solo texto (para queries)
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedOne(text) {
  const results = await embedBatch([text]);
  return results[0];
}

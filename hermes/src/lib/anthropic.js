import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const MODEL = process.env.HERMES_MODEL || "claude-opus-4-8";

/**
 * Appelle Claude et retourne un objet JSON validé par le schéma.
 * Gère la boucle pause_turn des outils serveur (web_search / web_fetch).
 */
export async function askJson({ system, prompt, schema, tools, maxTokens = 16000 }) {
  let messages = [{ role: "user", content: prompt }];
  let response;

  for (let i = 0; i < 6; i++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system,
      messages,
      ...(tools ? { tools } : {}),
      output_config: {
        format: { type: "json_schema", schema },
      },
    });

    if (response.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: response.content }];
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Requête refusée par le modèle (stop_reason: refusal)");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Réponse tronquée (max_tokens atteint) — augmenter maxTokens");
  }

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`Pas de bloc texte dans la réponse (stop_reason: ${response.stop_reason})`);
  return JSON.parse(text);
}

export const WEB_TOOLS = [
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
  { type: "web_search_20260209", name: "web_search", max_uses: 3 },
];

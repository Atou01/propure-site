import { askJson, WEB_TOOLS } from "../lib/anthropic.js";
import { upsertProspect, prospectsByStatus } from "../lib/store.js";

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    companySummary: { type: "string", description: "2-3 phrases : ce que fait l'entreprise, taille, positionnement" },
    hook: { type: "string", description: "Le détail spécifique trouvé sur leur site qui sert d'accroche" },
    emailSubject: { type: "string" },
    emailBody: { type: "string", description: "Email individuel personnalisé, en français, 90-140 mots" },
    linkedinMessage: { type: "string", description: "Message LinkedIn court, max 280 caractères" },
    confidence: { type: "string", enum: ["haute", "moyenne", "basse"] },
  },
  required: ["companySummary", "hook", "emailSubject", "emailBody", "linkedinMessage", "confidence"],
  additionalProperties: false,
};

const SYSTEM = `Tu es l'Analyste d'Hermes, agent B2B de Pro Pure — produits ménagers
premium fabriqués en France (lessives, adoucissants, nettoyants, 20+ parfums
d'exception), en lancement en Suisse romande. Offre pro : tarifs dégressifs,
livraison récurrente par abonnement, échantillons gratuits.

Tu prépares des BROUILLONS d'approche que le fondateur validera et enverra
personnellement, un par un. RIEN n'est envoyé automatiquement.

Règles impératives (droit suisse, art. 3 al. 1 let. o LCD : pas de publicité de masse
sans consentement) :
- Chaque message doit être réellement individuel : cite un élément précis du site du
  prospect (le "hook"). Pas de formule générique réutilisable.
- Ton direct, sobre, suisse : pas de superlatifs creux, pas de pression commerciale.
- Toujours proposer un échange court ou un envoi d'échantillons, jamais de "vente" directe.
- Écris en français (vouvoiement).`;

export async function runAnalyste({ config, limit = 10 }) {
  const queue = prospectsByStatus("qualified")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  const drafted = [];
  for (const p of queue) {
    console.log(`[analyste] ${p.name} (${p.website || "pas de site"})...`);
    const segment = config.segments.find((s) => s.id === p.segment);
    try {
      const draft = await askJson({
        system: SYSTEM,
        tools: p.website ? WEB_TOOLS : undefined,
        prompt:
          `Prospect : ${p.name}\n` +
          (p.website ? `Site web à analyser : ${p.website}\n` : "Pas de site web connu — base-toi sur le nom, le segment et une recherche web.\n") +
          (p.linkedin ? `LinkedIn : ${p.linkedin}\n` : "") +
          `Segment : ${segment?.label || p.segment}\n` +
          `Angle de vente : ${segment?.pitchAngle || ""}\n\n` +
          `Analyse ce prospect (visite son site si disponible) puis rédige le brouillon d'approche.`,
        schema: DRAFT_SCHEMA,
      });
      upsertProspect({ apolloId: p.apolloId, status: "drafted", draft });
      drafted.push({ ...p, draft });
    } catch (err) {
      console.error(`[analyste] échec pour ${p.name}: ${err.message}`);
      upsertProspect({ apolloId: p.apolloId, status: "error", error: err.message });
    }
  }
  return drafted;
}

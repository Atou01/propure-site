import { searchCompanies } from "../lib/apollo.js";
import { askJson } from "../lib/anthropic.js";
import { knownIds, upsertProspect } from "../lib/store.js";

const QUALIFY_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          apolloId: { type: "string" },
          qualified: { type: "boolean" },
          score: { type: "integer", description: "Pertinence 0-10 comme client B2B Pro Pure" },
          reason: { type: "string", description: "Une phrase en français" },
        },
        required: ["apolloId", "qualified", "score", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

const SYSTEM = `Tu es le Scout d'Hermes, l'agent de prospection B2B de Pro Pure,
une marque de produits ménagers premium fabriqués en France (lessives, adoucissants,
nettoyants, 20+ parfums) qui se lance en Suisse romande.

Ta mission : filtrer des résultats bruts Apollo. Un prospect est QUALIFIÉ s'il s'agit
d'une vraie PME locale de Suisse romande susceptible d'acheter des produits ménagers
en volume : conciergerie / gestion locative Airbnb, entreprise de nettoyage, hôtel
boutique, B&B, institut, etc.

DISQUALIFIE : grandes chaînes internationales (Marriott, Kempinski...), éditeurs de
logiciels, sociétés financières, grossistes concurrents de produits ménagers, et tout
résultat hors sujet ramené par les mots-clés Apollo.`;

export async function runScout({ config, maxNewPerSegment = 15 }) {
  const seen = knownIds();
  const segments = config.segments.filter((s) => s.enabled).sort((a, b) => a.priority - b.priority);
  let totalNew = 0;

  for (const segment of segments) {
    console.log(`[scout] segment "${segment.id}"...`);
    const companies = await searchCompanies({
      keywords: segment.keywords,
      locations: config.locations,
      employeeRanges: config.employeeRanges,
      perPage: maxNewPerSegment,
    });

    const fresh = companies.filter((c) => !seen.has(c.apolloId));
    if (fresh.length === 0) {
      console.log(`[scout] rien de nouveau pour "${segment.id}"`);
      continue;
    }

    const { results } = await askJson({
      system: SYSTEM,
      prompt:
        `Segment ciblé : ${segment.label}\nAngle de vente : ${segment.pitchAngle}\n\n` +
        `Voici ${fresh.length} entreprises brutes (JSON). Qualifie chacune :\n` +
        JSON.stringify(fresh, null, 2),
      schema: QUALIFY_SCHEMA,
    });

    const byId = new Map(fresh.map((c) => [c.apolloId, c]));
    for (const r of results) {
      const company = byId.get(r.apolloId);
      if (!company) continue;
      upsertProspect({
        ...company,
        segment: segment.id,
        status: r.qualified ? "qualified" : "rejected",
        score: r.score,
        scoutReason: r.reason,
      });
      seen.add(r.apolloId);
      if (r.qualified) totalNew++;
    }
    console.log(`[scout] "${segment.id}": ${fresh.length} vus, ${results.filter((r) => r.qualified).length} qualifiés`);
  }

  return totalNew;
}

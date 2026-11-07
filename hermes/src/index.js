import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScout } from "./agents/scout.js";
import { runAnalyste } from "./agents/analyste.js";
import { sendDigest } from "./agents/digest.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.resolve(here, "../config/segments.json"), "utf8"));

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const limit = Number(process.env.DAILY_PROSPECT_LIMIT || 10);

const required = ["ANTHROPIC_API_KEY", "APOLLO_API_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Variables manquantes dans .env : ${missing.join(", ")}`);
  process.exit(1);
}

try {
  if (!only || only === "scout") {
    const n = await runScout({ config });
    console.log(`[hermes] scout terminé : ${n} nouveau(x) prospect(s) qualifié(s)`);
  }

  if (!only || only === "analyste" || only === "digest") {
    const drafted = await runAnalyste({ config, limit });
    console.log(`[hermes] analyste terminé : ${drafted.length} brouillon(s)`);
    if (drafted.length > 0) {
      await sendDigest(drafted);
    } else {
      console.log("[hermes] rien à envoyer aujourd'hui");
    }
  }
} catch (err) {
  console.error(`[hermes] erreur fatale : ${err.stack || err.message}`);
  process.exit(1);
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, "../../data");
const DB_PATH = path.join(DATA_DIR, "prospects.json");

function load() {
  if (!fs.existsSync(DB_PATH)) return { prospects: {} };
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function knownIds() {
  return new Set(Object.keys(load().prospects));
}

export function upsertProspect(prospect) {
  const db = load();
  const existing = db.prospects[prospect.apolloId] || {};
  db.prospects[prospect.apolloId] = { ...existing, ...prospect, updatedAt: new Date().toISOString() };
  save(db);
}

export function prospectsByStatus(status) {
  return Object.values(load().prospects).filter((p) => p.status === status);
}

export function stats() {
  const all = Object.values(load().prospects);
  const byStatus = {};
  for (const p of all) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  return { total: all.length, byStatus };
}

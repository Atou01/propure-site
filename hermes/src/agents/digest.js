import nodemailer from "nodemailer";
import { stats } from "../lib/store.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function prospectCard(p) {
  const d = p.draft;
  return `
  <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0;font-family:sans-serif">
    <h3 style="margin:0 0 4px">${esc(p.name)} <small>(score ${p.score}/10 · ${esc(p.segment)} · confiance ${esc(d.confidence)})</small></h3>
    <p style="margin:4px 0;color:#555">
      ${p.website ? `<a href="${esc(p.website)}">${esc(p.website)}</a> · ` : ""}
      ${p.linkedin ? `<a href="${esc(p.linkedin)}">LinkedIn</a> · ` : ""}
      ${p.phone ? esc(p.phone) : ""}
    </p>
    <p style="margin:8px 0"><em>${esc(d.companySummary)}</em></p>
    <p style="margin:8px 0"><strong>Accroche :</strong> ${esc(d.hook)}</p>
    <p style="margin:8px 0 4px"><strong>Objet :</strong> ${esc(d.emailSubject)}</p>
    <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px;font-family:inherit">${esc(d.emailBody)}</pre>
    <p style="margin:8px 0 4px"><strong>LinkedIn :</strong></p>
    <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px;font-family:inherit">${esc(d.linkedinMessage)}</pre>
  </div>`;
}

export async function sendDigest(drafted) {
  const s = stats();
  const date = new Date().toLocaleDateString("fr-CH", { dateStyle: "full" });

  const html = `
  <div style="font-family:sans-serif;max-width:720px">
    <h2>Hermes — digest du ${esc(date)}</h2>
    <p>${drafted.length} nouveau(x) brouillon(s) prêt(s) à valider.
    Pipeline total : ${s.total} prospects (${Object.entries(s.byStatus).map(([k, v]) => `${v} ${k}`).join(", ")}).</p>
    <p style="color:#8a6d3b;background:#fcf8e3;padding:10px;border-radius:6px">
      Rappel : relire, personnaliser si besoin, et envoyer chaque message individuellement.
      Hermes n'envoie jamais rien aux prospects lui-même (conformité LCD suisse).
    </p>
    ${drafted.map(prospectCard).join("")}
  </div>`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.DIGEST_FROM,
    to: process.env.DIGEST_TO,
    subject: `Hermes · ${drafted.length} brouillon(s) B2B — ${date}`,
    html,
  });
  console.log(`[digest] envoyé à ${process.env.DIGEST_TO}`);
}

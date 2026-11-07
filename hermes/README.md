# Hermes — agent B2B Pro Pure (Suisse romande)

Système multi-agents qui prépare la prospection B2B de Pro Pure. **Hermes n'envoie
jamais rien aux prospects** : il cherche, qualifie, analyse et rédige des brouillons,
puis t'envoie un digest quotidien par email. Toi seul valides et envoies — c'est
volontaire, pour rester conforme au droit suisse (art. 3 al. 1 let. o LCD : pas de
publicité de masse sans consentement).

## Les agents

| Agent | Rôle |
|---|---|
| **Scout** | Cherche des entreprises via Apollo.io (segments dans `config/segments.json`), déduplique, et fait qualifier chaque lot par Claude (élimine chaînes internationales, sociétés hors sujet…). |
| **Analyste** | Pour chaque prospect qualifié (les mieux notés d'abord, max `DAILY_PROSPECT_LIMIT` par exécution) : visite le site web du prospect (outil web_fetch), identifie une accroche spécifique, rédige un brouillon d'email individuel + un message LinkedIn. |
| **Digest** | Envoie le récapitulatif HTML du jour sur ta boîte mail (SMTP). |

L'état vit dans `data/prospects.json` (statuts : `qualified`, `rejected`, `drafted`, `error`).

## Déploiement sur le VPS Hostinger

```bash
# 1. Node 20+ requis
node -v   # sinon : installer via https://deb.nodesource.com ou nvm

# 2. Récupérer le code
git clone <url-du-repo> propure-site
cd propure-site/hermes
npm install

# 3. Configurer
cp .env.example .env
nano .env   # remplir les clés (voir ci-dessous)

# 4. Test manuel
node src/index.js
```

### Clés à remplir dans `.env`

- `ANTHROPIC_API_KEY` — créer sur https://platform.claude.com (Console → API Keys)
- `APOLLO_API_KEY` — Apollo.io → Settings → Integrations → API. Chaque recherche
  d'entreprises consomme **1 crédit Apollo**.
- `SMTP_*` / `DIGEST_*` — une boîte email de ton domaine (Hostinger fournit le SMTP).
  Le digest n'est envoyé qu'à toi, jamais aux prospects.

### Cron (exécution automatique, jours ouvrés à 6h)

```bash
mkdir -p ~/propure-site/hermes/logs
crontab -e
# ajouter :
0 6 * * 1-5 cd ~/propure-site/hermes && /usr/bin/node src/index.js >> logs/hermes.log 2>&1
```

## Coûts

- **Claude** : par défaut `claude-opus-4-8` (qualité max des brouillons). Pour réduire
  les coûts, mettre `HERMES_MODEL=claude-sonnet-5` (~40% du prix) ou
  `claude-haiku-4-5` dans `.env`.
- **Apollo** : 1 crédit par recherche de segment et par exécution (3 segments actifs
  = 3 crédits/jour). Le plan gratuit suffit pour tester.

## Régler le ciblage

Tout est dans `config/segments.json` : activer/désactiver un segment (`enabled`),
changer la priorité, les mots-clés Apollo, les villes, ou l'angle de vente
(`pitchAngle`) qui guide la rédaction des brouillons.

## Feuille de route

- **V2** : suivi des réponses Gmail, propositions de relances, mini-CRM, rendez-vous.
- **V3** : agent contenu (posts LinkedIn/Instagram, argumentaires PDF), reporting hebdo.

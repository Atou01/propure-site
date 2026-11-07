// Renvoie le pays du visiteur (en-tête de géolocalisation Vercel) pour afficher la bonne devise.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ country: req.headers['x-vercel-ip-country'] || null });
};

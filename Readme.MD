# SRCH Server

Proxy SearXNG + compteur global partagé entre tous les utilisateurs.

## Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/search` | Proxy vers SearXNG |
| `GET` | `/api/autocompleter` | Suggestions de recherche |
| `GET` | `/api/count` | Lire les stats globales |
| `POST` | `/api/count` | Incrémenter le compteur |
| `DELETE` | `/api/count` | Réinitialiser (protégé) |
| `GET` | `/health` | Statut du serveur |

## Déploiement sur Render

1. Push ce dossier sur GitHub
2. Sur [render.com](https://render.com) → **New Web Service**
3. Connecte ton repo, Render détecte `render.yaml` automatiquement
4. Variables d'environnement importantes :
   - `SEARXNG_URL` — URL de ton instance SearXNG
   - `COUNT_FILE` — chemin du fichier compteur (défaut `/var/data/count.json`)
   - `RESET_SECRET` — clé secrète pour le reset (optionnel)

> **Persistent Disk** : active-le dans Render pour que le compteur survive aux redémarrages.
> Sans disk, les stats sont remises à zéro à chaque redeploy (plan gratuit).

## Variables d'environnement

```env
PORT=3000
SEARXNG_URL=https://moteur-server-xng.onrender.com
COUNT_FILE=/var/data/count.json
RESET_SECRET=ton_secret_ici
```

## Mise à jour de netlify.toml

Remplace l'URL dans `netlify.toml` par celle de ce nouveau serveur :

```toml
[[redirects]]
  from = "/api/*"
  to = "https://TON-NOUVEAU-SERVER.onrender.com/:splat"
  status = 200
  force = true
```
# 🚀 Module d'Enrichissement et Prospection - CRM Gem Isolation

## 📋 Vue d'Ensemble

Ce document détaille l'implémentation complète des modules d'**Enrichissement Automatique** et de **Prospection Avancée** pour le CRM Gem Isolation.

### Fonctionnalités Principales

1. **Autocomplete SIRET Intelligent**
   - Suggestions en temps réel lors de la saisie
   - Recherche par SIRET ou nom d'entreprise
   - Enrichissement automatique des données

2. **Enrichissement Multi-Sources**
   - API SIRENE (INSEE) - Données officielles entreprises
   - API Recherche Entreprises (data.gouv.fr) - Moteur gouvernemental
   - API DPE (ADEME) - Performance énergétique bâtiments
   - API BDNB (CSTB) - 300+ informations techniques par bâtiment
   - API Pappers (optionnel) - Contacts téléphone/email

3. **Module de Prospection**
   - Recherche par codes NAF/APE
   - Filtres géographiques (région, département, code postal)
   - Filtres par critères techniques
   - Export Excel/CSV des prospects
   - Import direct des prospects comme clients

---

## 🏗️ Architecture

### Backend

```
backend/src/
├── services/
│   ├── cache.service.js              # Cache Redis + fallback mémoire
│   ├── enrichment.service.js         # Orchestration enrichissement
│   ├── prospection.service.js        # Recherche avancée prospects
│   └── external-api/
│       ├── sirene.service.js         # API INSEE
│       ├── recherche.service.js      # API data.gouv.fr
│       ├── dpe.service.js            # API ADEME
│       ├── bdnb.service.js           # API CSTB
│       └── pappers.service.js        # API Pappers (optionnel)
│
├── routes/
│   ├── enrichment.js                 # Endpoints enrichissement
│   └── prospection.js                # Endpoints prospection
│
└── database.js                       # Migration: champ donnees_enrichies
```

### Frontend

```
frontend/src/
├── components/
│   ├── SiretAutocomplete.jsx        # Autocomplete intelligent
│   └── SiretAutocomplete.module.css
│
├── pages/
│   ├── Prospection.jsx              # Interface recherche prospects
│   └── Prospection.module.css
│
└── App.jsx                          # Route /prospection ajoutée
```

---

## 🔧 Configuration

### 1. Installation des Dépendances

```bash
cd backend
npm install
```

**Nouvelles dépendances ajoutées:**
- `axios` - Requêtes HTTP
- `axios-retry` - Retry automatique
- `ioredis` - Client Redis
- `express-rate-limit` - Rate limiting
- `rate-limiter-flexible` - Rate limiting avancé

### 2. Configuration des Clés API

Créez un fichier `.env` dans `/backend/` (voir `.env.example`) :

```env
# ========================================
# APIs EXTERNES
# ========================================

# API SIRENE INSEE (https://portail-api.insee.fr/)
INSEE_API_KEY=your_insee_api_key
INSEE_API_SECRET=your_insee_api_secret

# API BDNB (https://bdnb.io/)
BDNB_API_KEY=your_bdnb_api_key

# API Pappers (optionnel - https://www.pappers.fr/api)
PAPPERS_API_KEY=your_pappers_api_key

# Redis (optionnel - fallback mémoire si non disponible)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cache TTL (en secondes)
CACHE_TTL=3600

# Enrichissement
AUTO_ENRICHMENT_ENABLED=true
ENRICHMENT_SOURCES=sirene,dpe,bdnb

# Prospection
PROSPECTION_MAX_RESULTS=1000
```

### 3. Obtenir les Clés API

#### API SIRENE (INSEE) - **GRATUITE**

1. Créer un compte sur https://portail-api.insee.fr/
2. Créer une application
3. Copier **Consumer Key** → `INSEE_API_KEY`
4. Copier **Consumer Secret** → `INSEE_API_SECRET`

#### API BDNB - **GRATUITE (Open)**

1. S'inscrire sur https://bdnb.io/
2. Demander une clé API Open
3. Copier la clé → `BDNB_API_KEY`

#### API Pappers - **FREEMIUM (100 req/mois)**

1. Créer un compte sur https://www.pappers.fr/api
2. Obtenir la clé API (100 requêtes gratuites/mois)
3. Copier la clé → `PAPPERS_API_KEY`

#### APIs Gratuites (Pas de clé requise)

- **API Recherche Entreprises** (data.gouv.fr) - Aucune clé requise
- **API DPE** (ADEME) - Open Data, aucune clé requise

### 4. Redis (Optionnel)

**Si Redis n'est PAS installé:**
- Le système utilise automatiquement un cache mémoire (fallback)
- Aucune action requise

**Pour installer Redis (recommandé pour production):**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# macOS
brew install redis
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:latest
```

---

## 📡 API Endpoints

### Enrichissement

#### GET `/api/enrichment/suggest`
Autocomplete SIRET/dénomination

**Query params:**
- `q` (string) - Requête de recherche (min 2 caractères)
- `limit` (number) - Nombre max de suggestions (défaut: 10)

**Réponse:**
```json
[
  {
    "siret": "12345678901234",
    "siren": "123456789",
    "denomination": "MA SOCIETE SAS",
    "adresse": "123 RUE EXEMPLE",
    "codePostal": "75001",
    "commune": "PARIS",
    "codeNAF": "4120B",
    "label": "MA SOCIETE SAS - 12345678901234 - PARIS"
  }
]
```

#### GET `/api/enrichment/siret/:siret`
Enrichissement complet par SIRET

**Query params:**
- `typeProduit` (string, optionnel) - destratification | pression | matelas_isolants

**Réponse:**
```json
{
  "siret": "12345678901234",
  "siren": "123456789",
  "dateEnrichissement": "2025-01-13T...",
  "sources": ["sirene", "bdnb", "dpe"],
  "denomination": "MA SOCIETE SAS",
  "adresse": {
    "adresseComplete": "123 RUE EXEMPLE",
    "codePostal": "75001",
    "commune": "PARIS"
  },
  "codeNAF": "4120B",
  "telephone": "+33123456789",
  "donneesTechniques": {
    "hauteur_max": 8,
    "m2_hors_bureau": 1200,
    "type_chauffage": "Gaz",
    "puissance_estimee": 60
  },
  "recommandations": [
    {
      "produit": "destratification",
      "pertinence": "haute",
      "raison": "Hauteur importante (8m) favorable à la stratification thermique"
    }
  ],
  "scoreCompletude": 85
}
```

#### POST `/api/enrichment/search`
Recherche avec enrichissement

**Body:**
```json
{
  "q": "société bâtiment",
  "codePostal": "75001",
  "codeNAF": "4120B",
  "typeProduit": "destratification",
  "enrich": true,
  "limit": 20
}
```

### Prospection

#### POST `/api/prospection/search`
Recherche avancée de prospects

**Body:**
```json
{
  "codeNAF": "4120B",
  "departement": "75",
  "region": "11",
  "typeProduit": "destratification",
  "enrichPhone": false,
  "limit": 100
}
```

**Réponse:**
```json
{
  "total": 150,
  "criteria": { ... },
  "results": [
    {
      "siret": "12345678901234",
      "denomination": "ENTREPRISE EXEMPLE",
      "adresse": { ... },
      "codeNAF": "4120B",
      "scorePertinence": 85,
      "recommandations": [ ... ],
      "telephone": "+33123456789"
    }
  ],
  "metadata": {
    "date": "2025-01-13T...",
    "sources": ["recherche-entreprises", "bdnb"]
  }
}
```

#### POST `/api/prospection/export/excel`
Export Excel des prospects

**Body:**
```json
{
  "results": [ ... ],
  "criteria": { ... }
}
```

**Réponse:** Fichier Excel téléchargeable

#### GET `/api/prospection/naf/relevant`
Codes NAF pertinents par produit

**Query params:**
- `typeProduit` (string) - destratification | pression | matelas_isolants

**Réponse:**
```json
{
  "typeProduit": "destratification",
  "codes": ["4120B", "4322B", "4329A", "4321A", "4322A"]
}
```

---

## 💡 Utilisation

### 1. Autocomplete SIRET dans Fiche Client

**Fonctionnement automatique:**

1. Ouvrir "Nouveau Client" ou modifier un client existant
2. Commencer à taper dans le champ SIRET:
   - Nom d'entreprise: "boulangerie paris"
   - SIRET: "12345..."
3. Sélectionner une suggestion dans la liste déroulante
4. **Le formulaire se remplit automatiquement** avec:
   - Dénomination
   - Adresse complète
   - Code postal
   - Téléphone (si disponible)
   - Code NAF
   - **Données techniques** (hauteur, surface, etc.)

5. Voir les recommandations de produits CEE

**Enrichissement manuel:**

Si le SIRET est tapé directement (14 chiffres), cliquer sur l'icône 🔍 pour enrichir.

### 2. Module de Prospection

**Accès:** Menu latéral → **Prospection**

**Workflow:**

1. **Configurer les filtres:**
   - Code NAF/APE (ex: 4120B - Construction)
   - Région (ex: Île-de-France)
   - Département (ex: 75)
   - Type de produit CEE (destratification, pression, matelas)
   - Limite de résultats (50-500)

2. **Options avancées:**
   - ☑ Enrichir avec numéros de téléphone (50 premiers)

3. **Lancer la recherche:**
   - Cliquer sur "Rechercher"
   - Attendre les résultats (10-30 secondes selon critères)

4. **Exploiter les résultats:**
   - **Exporter Excel:** Télécharger la liste complète
   - **Importer comme client:** Ajouter directement un prospect au CRM

**Score de Pertinence:**

Chaque prospect reçoit un score (0-100):
- **80-100 (Vert):** Très pertinent (données complètes + recommandations)
- **60-79 (Orange):** Pertinent (NAF correspondant)
- **0-59 (Gris):** Peu pertinent

### 3. Codes NAF Pertinents par Produit

**Destratification:**
- 4120B - Construction d'autres bâtiments
- 4322B - Installation équipements thermiques
- 4329A - Travaux d'isolation
- 4321A - Installation électrique

**Pression:**
- 4322A - Installation eau/gaz
- 4322B - Installation équipements thermiques
- 3511Z - Production d'électricité
- 3530Z - Production vapeur

**Matelas Isolants:**
- 4329A - Travaux d'isolation
- 4322B - Installation équipements thermiques
- 4391A - Travaux de charpente

---

## 🔄 Migration Base de Données

**Automatique au démarrage:**

Le champ `donnees_enrichies` (TEXT/JSON) est ajouté automatiquement à la table `clients` lors du premier lancement.

**Vérification:**

```sql
SELECT donnees_enrichies FROM clients WHERE id = 1;
```

Doit retourner JSON ou NULL.

---

## 🧪 Tests

### 1. Test Autocomplete SIRET

```bash
# Démarrer backend
cd backend
npm run dev

# Test manuel
curl "http://localhost:5000/api/enrichment/suggest?q=boulangerie&limit=5"
```

### 2. Test Enrichissement

```bash
# Enrichir un SIRET de test
curl "http://localhost:5000/api/enrichment/siret/55208131900036?typeProduit=destratification"
```

### 3. Test Prospection

```bash
# Recherche par NAF
curl -X POST http://localhost:5000/api/prospection/search \
  -H "Content-Type: application/json" \
  -d '{"codeNAF":"4120B","departement":"75","limit":10}'
```

---

## 📊 Performance & Quotas

### Cache

- **TTL par défaut:** 1 heure (3600s)
- **Cache SIRENE:** 24 heures
- **Cache DPE:** 2 heures
- **Cache BDNB:** 2 heures
- **Redis:** Recommandé pour production
- **Fallback mémoire:** Automatique si Redis indisponible

### Rate Limiting

| API                        | Limite          | Configuration               |
|----------------------------|-----------------|-----------------------------|
| SIRENE (INSEE)             | 30 req/s        | `SIRENE_RATE_LIMIT=30`      |
| Recherche Entreprises      | 10 req/s        | Conservateur (API publique) |
| DPE (ADEME)                | 10 req/s        | `DPE_RATE_LIMIT=10`         |
| BDNB                       | 10 req/s        | `BDNB_RATE_LIMIT=10`        |
| Pappers (gratuit)          | 2 req/s         | 100 req/mois total          |

### Quotas API

- **SIRENE:** Illimité (gratuit)
- **Recherche Entreprises:** Illimité (gratuit)
- **DPE:** Illimité (Open Data)
- **BDNB Open:** Vérifier avec CSTB
- **Pappers:** 100 requêtes/mois (gratuit)

---

## 🐛 Dépannage

### Redis non disponible

**Symptôme:** `⚠️ Redis error: ...`

**Solution:** Normal si Redis non installé. Le système utilise le cache mémoire automatiquement.

### API SIRENE ne fonctionne pas

**Symptômes:**
- `❌ Erreur authentification INSEE`
- `Impossible d'obtenir le token INSEE`

**Solutions:**
1. Vérifier `INSEE_API_KEY` et `INSEE_API_SECRET` dans `.env`
2. Vérifier que les clés sont valides sur https://portail-api.insee.fr/
3. Le système utilise automatiquement l'API Recherche Entreprises en fallback

### Aucun résultat de prospection

**Causes possibles:**
1. Critères trop restrictifs (essayer région seule)
2. Code NAF inexistant
3. API temporairement indisponible

**Solution:** Élargir les critères, tester avec un seul filtre.

### Export Excel échoue

**Symptôme:** Erreur lors de l'export

**Solution:**
1. Vérifier que `exceljs` est installé: `npm list exceljs`
2. Réinstaller si nécessaire: `npm install exceljs`

---

## 🔐 Sécurité

### Clés API

- **JAMAIS** committer `.env` dans Git
- Utiliser `.env.example` comme template
- Rotation régulière des clés (tous les 6 mois)

### Rate Limiting

- Protection automatique contre les abus
- Pas de contournement possible
- Respect des quotas API

### Données Enrichies

- Stockées en JSON dans `clients.donnees_enrichies`
- Pas de données sensibles (pas de mots de passe, etc.)
- Conforme RGPD (données publiques)

---

## 📈 Évolutions Futures

### Court Terme

- [ ] Télécharger base NAF/APE complète (CSV)
- [ ] Interface de sélection multi-NAF
- [ ] Historique des recherches de prospection
- [ ] Filtres sauvegardés

### Moyen Terme

- [ ] Enrichissement automatique périodique
- [ ] Notifications pour nouveaux prospects pertinents
- [ ] Intégration API téléphone premium (si budget)
- [ ] Dashboard analytics prospection

### Long Terme

- [ ] Machine Learning pour scoring
- [ ] Prédiction taux de conversion
- [ ] Segmentation automatique
- [ ] A/B testing critères prospection

---

## 📚 Ressources

### Documentation APIs

- [API SIRENE INSEE](https://portail-api.insee.fr/)
- [API Recherche Entreprises](https://recherche-entreprises.api.gouv.fr/docs)
- [API DPE ADEME](https://data.ademe.fr)
- [API BDNB](https://bdnb.io/services/services_api/)
- [API Pappers](https://www.pappers.fr/api/documentation)

### Support

- Issues GitHub: [Créer une issue](#)
- Email support: [Votre email]

---

## ✅ Checklist Déploiement

- [ ] Configurer toutes les clés API dans `.env`
- [ ] Tester l'autocomplete SIRET
- [ ] Tester l'enrichissement complet
- [ ] Tester le module de prospection
- [ ] Tester l'export Excel
- [ ] Vérifier les logs backend
- [ ] Installer Redis (optionnel mais recommandé)
- [ ] Configurer les limites de rate limiting
- [ ] Backup de la base de données
- [ ] Documentation utilisateur fournie à l'équipe

---

**Date de création:** 13 Janvier 2025
**Version:** 1.0.0
**Auteur:** Claude Code
**Projet:** CRM Gem Isolation

# Guide d'obtention des clés API

Ce guide vous explique comment obtenir toutes les clés API nécessaires pour le module de prospection.

---

## 🔴 URGENT - Clés API critiques

### 1. API BDNB (Base de Données Nationale des Bâtiments)

**Pourquoi c'est critique**: Fournit hauteur, surface, type de chauffage, classe DPE - données essentielles pour scorer les prospects.

**Comment obtenir la clé**:

1. Allez sur https://bdnb.io/inscription
2. Remplissez le formulaire d'inscription (gratuit)
3. Confirmez votre email
4. Connectez-vous sur https://bdnb.io/
5. Allez dans "Mon compte" ou "API"
6. Copiez votre clé API

**Format de la clé**: Chaîne alphanumérique longue (ex: `bdnb_abc123def456...`)

**Ajout dans le .env**:
```env
BDNB_API_KEY=votre_cle_ici
```

**Taux de limite**: 10 requêtes/seconde (gratuit)

---

### 2. API INSEE SIRENE

**Pourquoi c'est critique**: Données officielles des entreprises françaises (fallback si API Recherche Entreprises échoue).

**Comment obtenir la clé**:

1. Allez sur https://portail-api.insee.fr/
2. Cliquez sur "S'inscrire" (gratuit)
3. Créez un compte
4. Connectez-vous
5. Allez dans "Mes applications"
6. Créez une nouvelle application
7. Nom: "CRM Prospection"
8. Description: "Module de prospection pour CRM"
9. Sélectionnez l'API "Sirene"
10. Validez
11. Copiez les clés:
    - **Consumer Key** (clé publique)
    - **Consumer Secret** (clé secrète)

**Format de la clé**:
- Consumer Key: chaîne alphanumérique
- Consumer Secret: chaîne alphanumérique

**Ajout dans le .env**:
```env
INSEE_CONSUMER_KEY=votre_consumer_key
INSEE_CONSUMER_SECRET=votre_consumer_secret
```

**Taux de limite**: 30 requêtes/seconde

**Notes**:
- L'authentification INSEE utilise OAuth2
- Les tokens doivent être rafraîchis régulièrement
- Le code actuel gère déjà l'authentification, il suffit d'ajouter les clés

---

### 3. API IGN - BD TOPO (Institut Géographique National)

**Pourquoi c'est critique**: Fournit la hauteur la plus précise des bâtiments (données topographiques officielles).

**Comment obtenir la clé**:

1. Allez sur https://geoplateforme.fr/
2. Cliquez sur "Créer un compte" (gratuit)
3. Remplissez le formulaire
4. Confirmez votre email
5. Connectez-vous
6. Allez dans "Mes clés"
7. Créez une nouvelle clé
8. Nom: "CRM Prospection"
9. Autorisations: Cochez "WFS" et "BDTOPO"
10. Créez la clé
11. Copiez la clé générée

**Format de la clé**: Chaîne alphanumérique

**Ajout dans le .env**:
```env
IGN_API_KEY=votre_cle_ici
```

**Taux de limite**:
- Gratuit: 10 requêtes/seconde
- Pro: 100 requêtes/seconde (payant)

**Note**: Actuellement le code utilise `apikey=essentiels` (clé démo), à remplacer par votre clé.

---

## 🟢 APIs sans clé requise

Ces APIs sont 100% gratuites et ne nécessitent pas de clé:

### API Recherche Entreprises
- URL: https://recherche-entreprises.api.gouv.fr/
- Authentification: Aucune
- Documentation: https://recherche-entreprises.api.gouv.fr/docs

### BAN (Base Adresse Nationale)
- URL: https://api-adresse.data.gouv.fr/
- Authentification: Aucune
- Documentation: https://adresse.data.gouv.fr/api-doc/adresse

### RNB (Référentiel National des Bâtiments)
- URL: https://rnb-api.beta.gouv.fr/
- Authentification: Aucune (recommandé d'ajouter `from=email`)
- Documentation: https://rnb-fr.gitbook.io/documentation/

### Géorisques (ICPE)
- URL: https://www.georisques.gouv.fr/api/v1
- Authentification: Aucune
- Documentation: https://www.georisques.gouv.fr/doc-api

### DPE ADEME
- URL: https://data.ademe.fr/
- Authentification: Aucune
- Documentation: https://data.ademe.fr/datasets/dpe-france

---

## 📝 Configuration finale du .env

Après avoir obtenu toutes les clés, votre fichier `.env` dans `/root/crm/backend/` doit contenir:

```env
# Base de données
DATABASE_PATH=./database.db

# JWT
JWT_SECRET=votre_secret_jwt_existant

# APIs - Clés requises
BDNB_API_KEY=votre_cle_bdnb_ici
INSEE_CONSUMER_KEY=votre_consumer_key_insee
INSEE_CONSUMER_SECRET=votre_consumer_secret_insee
IGN_API_KEY=votre_cle_ign_ici

# APIs - Pas de clé requise (informationnel)
# API_RECHERCHE_ENTREPRISES=https://recherche-entreprises.api.gouv.fr
# BAN_API=https://api-adresse.data.gouv.fr
# RNB_API=https://rnb-api.beta.gouv.fr
# GEORISQUES_API=https://www.georisques.gouv.fr/api/v1
# DPE_API=https://data.ademe.fr

# Email pour RNB (optionnel mais recommandé)
RNB_CONTACT_EMAIL=contact@liro-marketing.com
```

---

## 🧪 Tester les clés API

Après avoir ajouté les clés, testez-les avec ce script:

```bash
cd /root/crm/backend
node test-api-keys.js
```

(Script de test à créer - vérifiez chaque API)

---

## ⚠️ Sécurité

- ❌ **NE JAMAIS** commiter le fichier `.env` dans Git
- ✅ Le `.gitignore` doit contenir `.env`
- ✅ Gardez vos clés privées et ne les partagez pas
- ✅ Changez les clés si elles sont compromises
- ✅ Utilisez des clés différentes pour dev/prod si possible

---

## 📊 Estimation du temps

- BDNB: 5 minutes
- INSEE: 10 minutes (validation email + OAuth)
- IGN: 5 minutes

**Total**: ~20-30 minutes pour obtenir toutes les clés

---

## 🆘 En cas de problème

### BDNB - Pas de réponse à l'email de confirmation
- Vérifiez vos spams
- Réessayez avec une autre adresse email
- Contactez support@bdnb.io

### INSEE - OAuth2 complexe
- Le code gère déjà l'authentification OAuth2
- Il suffit de fournir Consumer Key et Secret
- Si erreurs 401: vérifiez que l'API "Sirene" est bien activée

### IGN - Clé invalide
- Vérifiez que WFS est autorisé dans les permissions
- Vérifiez que BDTOPO V3 est accessible
- La clé peut prendre quelques minutes avant d'être active

---

## 📞 Support

- BDNB: https://bdnb.io/contact
- INSEE: https://portail-api.insee.fr/support
- IGN: https://geoservices.ign.fr/contact

# 🔐 Guide de Sécurité - CRM Gem Isolation

## ⚠️ Fichiers Sensibles

**NE JAMAIS COMMITTER ces fichiers dans Git:**

- `.env` (backend)
- `.env.deploy` (credentials VPS)
- `database.db` (données de production)
- Tout fichier contenant des clés API ou mots de passe

## 🔑 Configuration des Variables d'Environnement

### Backend (.env)

```bash
# Copier le fichier exemple
cp backend/.env.example backend/.env

# Éditer avec vos vraies valeurs
nano backend/.env
```

**Variables critiques à configurer:**
- `JWT_SECRET`: Générer un secret fort (min 32 caractères)
- `INSEE_API_KEY`: Obtenir sur https://portail-api.insee.fr/
- `PAPPERS_API_KEY`: Obtenir sur https://www.pappers.fr/api

### Déploiement (.env.deploy)

```bash
# Copier le fichier exemple
cp .env.deploy.example .env.deploy

# Éditer avec vos credentials VPS
nano .env.deploy
```

**Variables critiques:**
- `VPS_HOST`: IP de votre serveur
- `VPS_PASS`: Mot de passe root SSH
- `GITHUB_TOKEN`: Token d'accès au repo privé

## 🚨 Checklist Sécurité

### Avant chaque commit:

- [ ] Vérifier qu'aucun fichier .env n'est staged
- [ ] Vérifier qu'aucun mot de passe n'est dans le code
- [ ] Vérifier que .gitignore est à jour

```bash
# Commande de vérification
git status --ignored
```

### En production:

- [ ] Changer tous les secrets par défaut
- [ ] Utiliser HTTPS avec certificat SSL valide
- [ ] Activer le firewall (ufw)
- [ ] Configurer fail2ban pour SSH
- [ ] Backup quotidien de la base de données
- [ ] Rotation des logs
- [ ] Monitoring des accès

## 🔄 Rotation des Secrets

**Fréquence recommandée:**
- JWT_SECRET: Tous les 6 mois
- API Keys: Lors de suspicion de fuite
- VPS_PASS: Tous les 3 mois

## 📞 Que faire en cas de fuite?

1. **Révoquer immédiatement** la clé/token exposé
2. Générer de nouvelles credentials
3. Mettre à jour tous les environnements
4. Analyser l'historique git:

```bash
# Chercher les fuites dans l'historique
git log --all --full-history --source --find-copies-harder -- .env .env.deploy

# Si trouvé, utiliser git-filter-repo pour nettoyer
```

5. Forcer un push (si nécessaire):

```bash
git push origin --force --all
```

## 🛡️ Bonnes Pratiques

1. **Ne jamais hardcoder** de secrets dans le code
2. Utiliser des gestionnaires de secrets (Vault, AWS Secrets Manager)
3. Limiter les permissions (principe du moindre privilège)
4. Activer l'authentification à deux facteurs (2FA)
5. Auditer régulièrement les accès

## 📚 Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [git-secrets](https://github.com/awslabs/git-secrets)

---

**Date de dernière mise à jour:** 2025-12-09
**Responsable Sécurité:** À définir

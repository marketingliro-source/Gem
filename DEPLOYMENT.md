# 🚀 Guide de Déploiement - CRM Gem Isolation

## 📋 Prérequis

### Accès VPS
- **IP**: Configurée dans `.env.deploy`
- **User**: root
- **Password**: Configuré dans `.env.deploy`
- **Port SSH**: 22

### Repository GitHub
- **Repo**: marketingliro-source/Gem (privé)
- **Token**: Configuré dans `.env.deploy`
- **Branche**: main

## 🔧 Configuration Initiale

### 1. Cloner le projet
```bash
git clone https://github.com/marketingliro-source/Gem.git
cd "CRM MOUSTACHE"
```

### 2. Configurer les variables d'environnement

**Backend:**
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Configurer:
- `JWT_SECRET`: Générer un secret fort
- `INSEE_API_KEY`: Clé API INSEE SIRENE
- `PAPPERS_API_KEY`: Clé API Pappers
- Autres clés API selon besoins

**Déploiement:**
```bash
cp .env.deploy.example .env.deploy
nano .env.deploy
```

Configurer:
- `VPS_HOST`: IP du serveur
- `VPS_PASS`: Mot de passe SSH
- `GITHUB_TOKEN`: Token GitHub
- `APP_DOMAIN`: Domaine de l'application

### 3. Installation locale

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🌐 Déploiement sur VPS

### Méthode 1: Script automatique

```bash
./deploy-with-env.sh
```

Ce script:
1. Copie le `.env` vers le VPS
2. Pull les dernières modifications
3. Installe les dépendances
4. Build le frontend
5. Redémarre les services

### Méthode 2: Déploiement manuel

```bash
# Connexion SSH
ssh root@159.198.47.216

# Naviguer vers le projet
cd /root/crm

# Pull les modifications
git pull origin main

# Backend
cd backend
npm install --production
pm2 restart crm-backend || pm2 start src/server.js --name crm-backend

# Frontend
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/crm-frontend/
sudo systemctl reload nginx

# Vérifier les logs
pm2 logs crm-backend
```

## 📊 Commandes Utiles

### Surveillance

```bash
# Logs backend en temps réel
pm2 logs crm-backend

# Status de tous les services
pm2 status

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Gestion PM2

```bash
# Redémarrer
pm2 restart crm-backend

# Arrêter
pm2 stop crm-backend

# Supprimer
pm2 delete crm-backend

# Sauvegarder la config
pm2 save

# Auto-démarrage au boot
pm2 startup
```

### Base de données

```bash
# Backup manuel
cp backend/database.db backend/database-$(date +%Y%m%d).db

# Restaurer un backup
cp backend/database-20251209.db backend/database.db
pm2 restart crm-backend
```

## 🔐 Sécurité

### SSL/HTTPS

Le certificat SSL est géré par Let's Encrypt:

```bash
# Renouveler le certificat
sudo certbot renew

# Tester le renouvellement
sudo certbot renew --dry-run
```

### Firewall

```bash
# Vérifier le status
sudo ufw status

# Autoriser les ports nécessaires
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 5001/tcp # Backend API

# Activer le firewall
sudo ufw enable
```

### Fail2ban

```bash
# Status
sudo systemctl status fail2ban

# Débannir une IP
sudo fail2ban-client set sshd unbanip <IP>
```

## 🐛 Dépannage

### Backend ne démarre pas

```bash
# Vérifier les logs
pm2 logs crm-backend --lines 100

# Vérifier les variables d'environnement
cat backend/.env

# Tester manuellement
cd backend
node src/server.js
```

### Frontend ne s'affiche pas

```bash
# Vérifier Nginx
sudo nginx -t
sudo systemctl status nginx

# Vérifier les fichiers
ls -la /var/www/crm-frontend/

# Rebuild
cd frontend
npm run build
sudo cp -r dist/* /var/www/crm-frontend/
```

### Base de données corrompue

```bash
# Vérifier l'intégrité
sqlite3 backend/database.db "PRAGMA integrity_check;"

# Restaurer depuis backup
cp backend/database-YYYYMMDD.db backend/database.db
pm2 restart crm-backend
```

### API externes ne fonctionnent pas

```bash
# Tester les clés API
curl -H "X-INSEE-Api-Key-Integration: YOUR_KEY" \
  https://api.insee.fr/entreprises/sirene/V3/siret/55208131900036

# Vérifier le cache Redis (si activé)
redis-cli ping
redis-cli INFO
```

## 📈 Monitoring

### Métriques PM2

```bash
# Dashboard interactif
pm2 monit

# Statistiques
pm2 describe crm-backend
```

### Logs structurés

Les logs sont stockés dans:
- Backend: `~/.pm2/logs/crm-backend-out.log`
- Backend errors: `~/.pm2/logs/crm-backend-error.log`
- Nginx: `/var/log/nginx/`

### Rotation des logs

PM2 gère automatiquement la rotation des logs. Pour configurer:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🔄 Mises à jour

### Mise à jour des dépendances

```bash
# Backend
cd backend
npm outdated
npm update

# Frontend
cd frontend
npm outdated
npm update
```

### Migration de la base de données

Les migrations sont automatiques au démarrage. Pour forcer:

```bash
# Backup avant migration
cp backend/database.db backend/database-pre-migration.db

# La migration se fait au démarrage
pm2 restart crm-backend
pm2 logs crm-backend --lines 50
```

## 📞 Support

En cas de problème:

1. Consulter les logs (`pm2 logs`)
2. Vérifier SECURITY.md pour les bonnes pratiques
3. Contacter l'équipe de développement

---

**Dernière mise à jour:** 2025-12-09
**Version:** 1.0.0
**Maintenu par:** Équipe Gem Isolation

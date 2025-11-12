#!/bin/bash

echo "🚀 Démarrage du déploiement CRM Leads Papa..."
echo "================================================"

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier qu'on est dans le bon dossier
if [ ! -f "deploy.sh" ]; then
    echo -e "${RED}❌ Erreur: Exécutez ce script depuis la racine du projet${NC}"
    exit 1
fi

# Pull les dernières modifications
echo -e "${BLUE}📥 Récupération des dernières modifications...${NC}"
git pull origin main || { echo -e "${RED}❌ Erreur lors du git pull${NC}"; exit 1; }

# BACKEND
echo -e "${BLUE}🔧 Déploiement du backend...${NC}"
cd backend
npm install --production || { echo -e "${RED}❌ Erreur lors de l'installation des dépendances backend${NC}"; exit 1; }

# Redémarrer le backend avec PM2
pm2 restart crm-backend || pm2 start src/server.js --name crm-backend
echo -e "${GREEN}✅ Backend redémarré${NC}"

# FRONTEND
echo -e "${BLUE}🎨 Build du frontend...${NC}"
cd ../frontend
npm install || { echo -e "${RED}❌ Erreur lors de l'installation des dépendances frontend${NC}"; exit 1; }
npm run build || { echo -e "${RED}❌ Erreur lors du build frontend${NC}"; exit 1; }

# Copier les fichiers build
echo -e "${BLUE}📦 Copie des fichiers build...${NC}"
sudo rm -rf /var/www/crm-frontend/*
sudo cp -r dist/* /var/www/crm-frontend/
echo -e "${GREEN}✅ Frontend déployé${NC}"

# Retour à la racine
cd ..

# Redémarrer Nginx (optionnel)
echo -e "${BLUE}🔄 Redémarrage de Nginx...${NC}"
sudo systemctl reload nginx

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✨ Déploiement terminé avec succès !${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "📊 Vérifier les logs: pm2 logs crm-backend"
echo "📈 Monitoring: pm2 monit"
echo "🌐 Application: http://$(hostname -I | awk '{print $1}')"

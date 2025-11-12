#!/bin/bash

echo "🔧 Installation et configuration du VPS pour CRM Leads Papa"
echo "============================================================="

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifier qu'on est root ou sudo
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Ce script doit être exécuté en root ou avec sudo${NC}" 
   exit 1
fi

echo -e "${BLUE}📦 Mise à jour du système...${NC}"
apt update && apt upgrade -y

echo -e "${BLUE}📦 Installation des dépendances système...${NC}"
apt install -y curl git nginx ufw

echo -e "${BLUE}📦 Installation de Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${BLUE}📦 Installation de PM2...${NC}"
npm install -g pm2

echo -e "${BLUE}🔒 Configuration du firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo -e "${GREEN}✅ Firewall configuré${NC}"

echo -e "${BLUE}📂 Création des dossiers...${NC}"
mkdir -p /var/www/crm-frontend
mkdir -p /var/backups

echo -e "${BLUE}📥 Clonage du repository...${NC}"
cd /var/www
git clone https://github.com/ECOHABITATCONSULTING/crmecohabitat.git
echo -e "${GREEN}✅ Repository cloné${NC}"

echo -e "${YELLOW}⚠️  Configuration manuelle requise:${NC}"
echo ""
echo "1. Créer le fichier .env dans backend:"
echo "   cd /var/www/crmecohabitat/backend"
echo "   nano .env"
echo ""
echo "   Contenu du .env:"
echo "   PORT=5001"
echo "   JWT_SECRET=votre_secret_tres_securise_ici_changez_moi"
echo "   NODE_ENV=production"
echo ""
echo "2. Copier la configuration Nginx:"
echo "   cp /var/www/crmecohabitat/nginx.conf /etc/nginx/sites-available/crm"
echo "   ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/"
echo "   nginx -t"
echo "   systemctl restart nginx"
echo ""
echo "3. Lancer le premier déploiement:"
echo "   cd /var/www/crmecohabitat"
echo "   chmod +x deploy.sh"
echo "   ./deploy.sh"
echo ""
echo -e "${GREEN}✅ Installation système terminée !${NC}"

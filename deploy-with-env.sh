#!/bin/bash

echo "🚀 Déploiement CRM avec configuration .env"
echo "==========================================="

# Copier le .env local vers le VPS
echo "📤 Copie du .env vers le VPS..."
scp "/home/jokyjokeai/Desktop/CRM MOUSTACHE/backend/.env" root@159.198.47.216:/root/crm/backend/.env

# Se connecter au VPS et déployer
echo "🔄 Déploiement sur le VPS..."
ssh root@159.198.47.216 << 'ENDSSH'
cd /root/crm

# Pull les dernières modifications
echo "📥 Git pull..."
git pull origin main

# Backend
echo "🔧 Installation dépendances backend..."
cd backend
npm install --production

# Redémarrer PM2
echo "♻️  Redémarrage backend..."
pm2 restart backend || pm2 start src/server.js --name backend

# Frontend
echo "🎨 Build frontend..."
cd ../frontend
npm install
npm run build

# Copier vers Nginx
echo "📦 Déploiement frontend..."
sudo rm -rf /var/www/crm-frontend/*
sudo cp -r dist/* /var/www/crm-frontend/

# Redémarrer Nginx
echo "🔄 Redémarrage Nginx..."
sudo systemctl reload nginx

echo "✅ Déploiement terminé !"
pm2 logs backend --lines 20

ENDSSH

echo ""
echo "✨ Déploiement terminé avec succès !"
echo ""
echo "📊 Pour voir les logs: ssh root@159.198.47.216 'pm2 logs backend'"
echo "🌐 Application: http://159.198.47.216"

#!/bin/bash

echo "========================================="
echo "🚀 Démarrage du CRM Leads"
echo "========================================="
echo ""

# Vérifier si les dépendances sont installées
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installation des dépendances backend..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installation des dépendances frontend..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "✅ Démarrage du serveur backend (port 5000)..."
cd backend && npm run dev &
BACKEND_PID=$!

echo "⏳ Attente du démarrage du backend..."
sleep 5

echo "✅ Démarrage du serveur frontend (port 3000)..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "✨ CRM Leads démarré avec succès!"
echo "========================================="
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:5000/api"
echo ""
echo "👤 Compte admin:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "Pour arrêter les serveurs: Ctrl+C"
echo "========================================="
echo ""

# Attendre que l'utilisateur arrête les serveurs
wait

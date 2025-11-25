#!/bin/bash

echo "🔒 Installation SSL Let's Encrypt pour www.liro-marketing.com"
echo "=============================================================="

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Vérifier qu'on est root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ce script doit être exécuté en tant que root${NC}"
    echo "Utilisez: sudo ./install-ssl.sh"
    exit 1
fi

# Domaine
DOMAIN="www.liro-marketing.com"
EMAIL="contact@liro-marketing.com"  # Remplacer par votre email

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Domaine: $DOMAIN"
echo "   Email: $EMAIL"
echo ""

# 1. Installer Certbot si pas déjà installé
echo -e "${BLUE}📦 Vérification de Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    echo "Installation de Certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✅ Certbot installé${NC}"
else
    echo -e "${GREEN}✅ Certbot déjà installé${NC}"
fi

# 2. Vérifier que Nginx est installé
echo -e "${BLUE}🔍 Vérification de Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx n'est pas installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Nginx trouvé${NC}"

# 3. Vérifier la configuration Nginx existante
echo -e "${BLUE}🔍 Recherche de la configuration Nginx...${NC}"
NGINX_CONF="/etc/nginx/sites-available/crm"
if [ ! -f "$NGINX_CONF" ]; then
    NGINX_CONF="/etc/nginx/sites-available/default"
fi

if [ ! -f "$NGINX_CONF" ]; then
    echo -e "${RED}❌ Configuration Nginx introuvable${NC}"
    exit 1
fi

echo "Configuration trouvée: $NGINX_CONF"

# 4. Backup de la configuration actuelle
echo -e "${BLUE}💾 Sauvegarde de la configuration...${NC}"
cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ Backup créé${NC}"

# 5. S'assurer que le domaine est bien dans la config
echo -e "${BLUE}🔍 Vérification du domaine dans la configuration...${NC}"
if ! grep -q "$DOMAIN" "$NGINX_CONF"; then
    echo -e "${YELLOW}⚠️  Ajout du domaine à la configuration Nginx...${NC}"

    # Ajouter server_name si manquant
    sed -i "s/server_name _;/server_name $DOMAIN;/" "$NGINX_CONF"

    # Tester la configuration
    nginx -t
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur dans la configuration Nginx${NC}"
        exit 1
    fi

    # Recharger Nginx
    systemctl reload nginx
    echo -e "${GREEN}✅ Domaine ajouté${NC}"
else
    echo -e "${GREEN}✅ Domaine déjà présent${NC}"
fi

# 6. Vérifier que le port 80 est accessible
echo -e "${BLUE}🔍 Vérification du port 80...${NC}"
if netstat -tuln | grep -q ':80 '; then
    echo -e "${GREEN}✅ Port 80 accessible${NC}"
else
    echo -e "${RED}❌ Port 80 non accessible${NC}"
    echo "Vérifiez votre pare-feu (ufw, iptables)"
    exit 1
fi

# 7. Obtenir le certificat SSL
echo -e "${BLUE}🔒 Obtention du certificat SSL Let's Encrypt...${NC}"
echo -e "${YELLOW}⚠️  Cette étape peut prendre quelques minutes...${NC}"
echo ""

certbot --nginx \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --redirect \
    --non-interactive

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Certificat SSL installé avec succès !${NC}"
    echo ""
    echo -e "${GREEN}🎉 Votre site est maintenant accessible en HTTPS:${NC}"
    echo -e "${GREEN}   https://$DOMAIN${NC}"
    echo ""

    # 8. Configurer le renouvellement automatique
    echo -e "${BLUE}🔄 Configuration du renouvellement automatique...${NC}"

    # Tester le renouvellement
    certbot renew --dry-run

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Renouvellement automatique configuré${NC}"
        echo "   Le certificat sera renouvelé automatiquement tous les 90 jours"
    else
        echo -e "${YELLOW}⚠️  Renouvellement automatique à vérifier manuellement${NC}"
    fi

    # 9. Redémarrer Nginx
    echo -e "${BLUE}🔄 Redémarrage de Nginx...${NC}"
    systemctl restart nginx
    echo -e "${GREEN}✅ Nginx redémarré${NC}"

    # 10. Afficher l'état du certificat
    echo ""
    echo -e "${BLUE}📋 Informations sur le certificat:${NC}"
    certbot certificates -d "$DOMAIN"

    echo ""
    echo -e "${GREEN}=============================================================${NC}"
    echo -e "${GREEN}✨ Installation SSL terminée avec succès !${NC}"
    echo -e "${GREEN}=============================================================${NC}"
    echo ""
    echo -e "${BLUE}📝 Prochaines étapes:${NC}"
    echo "   1. Testez votre site: https://$DOMAIN"
    echo "   2. Vérifiez la redirection HTTP → HTTPS"
    echo "   3. Testez le certificat SSL: https://www.ssllabs.com/ssltest/"
    echo ""
    echo -e "${BLUE}🔄 Renouvellement automatique:${NC}"
    echo "   • Vérifié automatiquement 2x par jour"
    echo "   • Renouvelé 30 jours avant expiration"
    echo "   • Logs: /var/log/letsencrypt/"
    echo ""
    echo -e "${BLUE}🛠️  Commandes utiles:${NC}"
    echo "   • Forcer renouvellement: certbot renew --force-renewal"
    echo "   • Liste certificats: certbot certificates"
    echo "   • Révoquer certificat: certbot revoke --cert-name $DOMAIN"
    echo ""

else
    echo ""
    echo -e "${RED}❌ Erreur lors de l'installation du certificat SSL${NC}"
    echo ""
    echo -e "${YELLOW}Causes possibles:${NC}"
    echo "   1. Le domaine $DOMAIN ne pointe pas vers ce serveur"
    echo "   2. Le port 80 n'est pas accessible depuis Internet"
    echo "   3. Un pare-feu bloque les connexions entrantes"
    echo "   4. Un certificat existe déjà pour ce domaine"
    echo ""
    echo -e "${BLUE}Vérifications:${NC}"
    echo "   • DNS: dig $DOMAIN"
    echo "   • Pare-feu: ufw status"
    echo "   • Nginx: nginx -t"
    echo "   • Logs Certbot: /var/log/letsencrypt/letsencrypt.log"
    echo ""
    exit 1
fi

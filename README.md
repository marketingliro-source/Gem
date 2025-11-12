# CRM Leads - Papa

Un système CRM moderne et futuriste pour la gestion de leads avec un design épuré et des fonctionnalités complètes.

## Fonctionnalités

### Authentification
- Connexion sécurisée avec JWT
- Gestion des rôles (Admin / Agent)
- Compte admin par défaut: `admin` / `admin123`

### Gestion des Leads
- Affichage avec pagination (20 leads par page)
- Filtrage par statut (Nouveau, NRP, À rappeler, Pas intéressé, Corbeille)
- Recherche par nom, prénom, email, téléphone
- Changement de statut en un clic
- Sélection multiple pour actions en masse
- Actions en masse: Attribuer, Recycler, Supprimer

### Statuts des Leads
- **Nouveau**: Lead fraîchement importé
- **NRP**: No Response (Pas de réponse)
- **À rappeler**: Lead à recontacter
- **Pas intéressé**: Lead qui n'est pas intéressé
- **Corbeille**: Leads à supprimer

### Fiche Lead
- Informations complètes du lead
- Ajout de commentaires
- Historique des commentaires avec auteur et date
- Création de rendez-vous
- Liste des rendez-vous programmés

### Recyclage des Leads
- Remise à zéro du lead (statut → Nouveau)
- Suppression de tous les commentaires
- Suppression de tous les rendez-vous
- Désattribution du lead

### Import CSV
- Import en masse de leads
- Modèle CSV téléchargeable
- Format: `first_name,last_name,email,phone`
- Validation automatique des données
- Rapport d'erreurs détaillé

### Attribution (Admin)
- Menu "Leads à attribuer" pour les nouveaux imports
- Attribution individuelle ou en masse
- Vue globale de tous les leads
- Gestion des agents

### Agenda
- Vue hebdomadaire avec drag & drop
- Visualisation de tous les rendez-vous
- Filtrage par agent (admin) ou personnel (agent)
- Création rapide de RDV depuis une fiche lead

### Gestion des Utilisateurs (Admin)
- Création d'utilisateurs (Admin/Agent)
- Attribution de mots de passe
- Suppression d'utilisateurs
- Vue des permissions

## Installation

### Backend

```bash
cd backend
npm install
npm run dev
```

Le serveur démarre sur http://localhost:5000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

L'application démarre sur http://localhost:3000

## Technologies

### Backend
- Node.js + Express
- SQLite (base de données locale)
- JWT pour l'authentification
- Bcrypt pour les mots de passe
- Multer pour l'upload CSV
- csv-parser pour l'import

### Frontend
- React 18
- React Router pour la navigation
- Axios pour les requêtes API
- CSS Modules pour le styling
- Lucide React pour les icônes
- Design futuriste avec effets néon

## Structure de la Base de Données

### Users
- id, username, password, role (admin/agent)

### Leads
- id, first_name, last_name, email, phone, status, assigned_to, created_at, updated_at

### Comments
- id, lead_id, user_id, content, created_at

### Appointments
- id, lead_id, user_id, title, date, time, created_at

## API Endpoints

### Auth
- POST `/api/auth/login` - Connexion
- GET `/api/auth/me` - Vérifier le token

### Users
- GET `/api/users` - Liste des utilisateurs (admin)
- POST `/api/users` - Créer un utilisateur (admin)
- DELETE `/api/users/:id` - Supprimer un utilisateur (admin)
- GET `/api/users/agents` - Liste des agents

### Leads
- GET `/api/leads` - Liste des leads (avec pagination et filtres)
- GET `/api/leads/unassigned` - Leads non attribués (admin)
- POST `/api/leads` - Créer un lead
- PATCH `/api/leads/:id` - Mettre à jour un lead
- POST `/api/leads/assign` - Attribuer des leads (admin)
- POST `/api/leads/recycle` - Recycler des leads
- DELETE `/api/leads/bulk` - Supprimer en masse
- POST `/api/leads/import` - Import CSV (admin)

### Comments
- GET `/api/comments/lead/:leadId` - Commentaires d'un lead
- POST `/api/comments` - Ajouter un commentaire
- DELETE `/api/comments/:id` - Supprimer un commentaire

### Appointments
- GET `/api/appointments` - Liste des RDV
- GET `/api/appointments/lead/:leadId` - RDV d'un lead
- POST `/api/appointments` - Créer un RDV
- PATCH `/api/appointments/:id` - Modifier un RDV
- DELETE `/api/appointments/:id` - Supprimer un RDV

## Design

Le CRM utilise un design futuriste avec:
- Logo moustache en SVG avec gradient
- Couleurs néon (bleu/violet)
- Effets de glow et blur
- Animations fluides
- Interface sombre (dark mode natif)
- Cartes avec bordures lumineuses
- Typographie moderne

## Sécurité

- Mots de passe hashés avec bcrypt
- Authentification JWT
- Protection des routes par rôle
- Validation des données côté serveur
- CORS configuré

## Développement Local

1. Cloner le projet
2. Installer les dépendances backend et frontend
3. Lancer le backend: `cd backend && npm run dev`
4. Lancer le frontend: `cd frontend && npm run dev`
5. Se connecter avec: `admin` / `admin123`
6. Créer des agents
7. Importer des leads via CSV
8. Attribuer les leads aux agents

## Notes

- Base de données SQLite créée automatiquement
- Un utilisateur admin est créé au premier lancement
- Les leads importés vont dans "Leads à attribuer"
- Les agents ne voient que leurs leads attribués
- Les admins ont accès à tout

## Prochaines Évolutions (Optionnel)

- Dashboard avec statistiques
- Notifications en temps réel
- Export de données
- Recherche avancée
- Historique des actions
- Envoi d'emails automatiques
- Intégration téléphonie
- Application mobile

---

Développé avec ❤️ pour Papa

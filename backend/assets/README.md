# Assets pour les PDFs de dimensionnement

Ce dossier contient les ressources utilisées pour la génération des PDFs de dimensionnement.

## 1. Logo de la société

**Fichier actuel** : `logo-ehc.jpg` ✅ (déjà ajouté)

Le logo d'Eco Habitat Consulting est utilisé dans les PDFs :

1. Format : JPG
2. Le logo apparaît en haut à gauche de chaque PDF généré
3. Pour changer le logo, remplacer le fichier `logo-ehc.jpg`

## 2. Carte des zones climatiques de France

**Fichier requis** : `france-climate-zones.png` ✅ (déjà ajouté)

Pour mettre à jour la carte de France avec les zones climatiques :

1. Ouvrir le fichier Excel : `Note de Dimensionnement_unlocked.xlsx`
2. Localiser l'image de la carte de France avec les zones climatiques (A, B, C, D, E, F, G, H, I)
3. Faire un clic droit sur l'image → Enregistrer en tant qu'image
4. Sauvegarder l'image sous le nom : `france-climate-zones.png`
5. Remplacer le fichier existant dans ce dossier

## 3. Informations de la société

Les informations d'Eco Habitat Consulting sont déjà configurées dans :
`/backend/src/routes/dimensioning.js`

```javascript
const companyInfo = {
  name: 'Eco Habitat Consulting',
  address: '42 Chemin Moulin Carron',
  postalCode: '69130',
  city: 'Ecully',
  phone: '04 51 68 09 45',
  email: 'etude@consulting-ehc.fr'
};
```

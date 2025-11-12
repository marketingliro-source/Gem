# Assets pour les PDFs de dimensionnement

Ce dossier contient les ressources utilisées pour la génération des PDFs de dimensionnement.

## 1. Logo de la société

**Fichier requis** : `logo.png`

Pour ajouter le logo de FRANCE ECO ENERGIE dans les PDFs :

1. Placer le fichier logo au format PNG dans ce dossier
2. Le nommer exactement : `logo.png`
3. Format recommandé : PNG transparent, dimensions idéales 400x200px ou ratio similaire
4. Le logo apparaîtra en haut à gauche de chaque PDF généré

## 2. Carte des zones climatiques de France

**Fichier requis** : `france-climate-zones.png` ✅ (déjà ajouté)

Pour mettre à jour la carte de France avec les zones climatiques :

1. Ouvrir le fichier Excel : `Note de Dimensionnement FRANCE ECO ENERGY_unlocked.xlsx`
2. Localiser l'image de la carte de France avec les zones climatiques (A, B, C, D, E, F, G, H, I)
3. Faire un clic droit sur l'image → Enregistrer en tant qu'image
4. Sauvegarder l'image sous le nom : `france-climate-zones.png`
5. Remplacer le fichier existant dans ce dossier

## 3. Informations de la société

Les informations de la société (adresse, téléphone, email, SIRET) sont à mettre à jour dans le fichier :
`/backend/src/routes/dimensioning.js`

Chercher la section `companyInfo` (environ ligne 273) et remplacer les valeurs par défaut :

```javascript
const companyInfo = {
  name: 'FRANCE ECO ENERGIE',
  address: 'Adresse de la société',
  postalCode: 'Code postal',
  city: 'Ville',
  phone: 'Téléphone',
  email: 'contact@france-eco-energie.fr',
  siret: 'SIRET: XXXXX'
};
```

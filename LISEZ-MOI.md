# acro-poles — installation

## 1. Côté Google Sheets

1. Dans Extensions > Apps Script de la feuille, remplace tout le contenu par
   `google-apps-script/Code.gs`.
2. **Déployer > Gérer les déploiements > crayon > Version : Nouvelle version >
   Déployer.** (Obligatoire après chaque modification du script, sinon
   l'ancienne version reste active sur l'URL /exec.)
3. Vérifie que "Qui a accès" est sur **Tout le monde**.

## 2. Côté app

1. Remplace sur GitHub (via GitHub Desktop) : `index.html`, `app.js`,
   `service-worker.js`, `manifest.json`, `icons/`.
2. Sur le téléphone et l'ordinateur, ferme complètement l'app/l'onglet puis
   rouvre l'adresse https — le service worker récupère automatiquement la
   nouvelle version (cache renommé côté code).
3. Dans les réglages ⚙, vérifie que l'URL du Web App est toujours la bonne,
   et règle l'**objectif mensuel** si tu veux autre chose que 40h.

## Nouveauté : compteur mensuel

- Juste sous le formulaire de saisie, une carte affiche le total d'heures du
  mois en cours pour la personne indiquée dans le champ "Personne", avec une
  barre de progression vers l'objectif.
- Ce total vient directement du tableau "Total personne (h)" de la feuille
  (pas du stockage local du téléphone) : il est donc le même sur tous les
  appareils, et se remet naturellement à 0 au changement de mois puisqu'il
  n'y a pas encore de données pour le nouveau mois.
- Bouton "Voir les mois précédents" : liste les mois déjà écoulés de l'année
  en cours avec leur total.
- Bouton "Actualiser" : relance la récupération depuis la feuille (utile
  après une modification manuelle, puisque le `onEdit` du script recalcule
  déjà le tableau, mais l'app doit quand même aller rechercher la nouvelle
  valeur).
- Fonctionne hors-ligne avec la dernière valeur connue (mise en cache sur
  l'appareil), avec la date de dernière synchro affichée en petit.

## Fonctionnement général (rappel)

- Chaque saisie est stockée sur l'appareil puis envoyée vers la feuille dès
  qu'une connexion est disponible (point orange = en attente d'envoi).
- **Exporter CSV** : sauvegarde locale de secours.
- **Vider l'historique** : efface uniquement l'affichage local de cet
  appareil, pas les données déjà envoyées à Google Sheets.

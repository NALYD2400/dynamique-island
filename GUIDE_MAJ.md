# 📝 Guide de Mise à Jour (M.A.J)

Ce document vous explique comment faire les prochaines mises à jour de votre application **Dynamic Island V2** et de votre **Tableau de bord Obsidian**.

---

## 🚀 1. Mettre à jour l'application (Dynamic Island V2)

Lorsque vous faites des modifications sur le code de l'application et voulez les envoyer à vos utilisateurs :

1. **Changer le numéro de version** :
   - Ouvrez le fichier [package.json](file:///C:/Project%20Dev/dynamique%20island%20V2/dynamique%20island/package.json).
   - Modifiez la ligne `"version": "1.0.2"` par la nouvelle version (ex: `"1.0.3"`).

2. **Compiler le projet** :
   - Ouvrez un terminal dans `C:\Project Dev\dynamique island V2\dynamique island\`.
   - Lancez la commande suivante pour générer les fichiers :
     ```powershell
     npm run build
     ```
   - Les fichiers compilés seront créés dans le dossier [dist/](file:///C:/Project%20Dev/dynamique%20island%20V2/dynamique%20island/dist/).

3. **Publier sur GitHub** :
   - Allez sur votre dépôt GitHub : [NALYD2400/dynamique-island](https://github.com/NALYD2400/dynamique-island).
   - Allez dans la section **Releases** et créez une nouvelle version (Draft a new release).
   - Créez le tag de version correspondant (ex : `v1.0.3`) et donnez-lui un titre (ex : `Version 1.0.3`).
   - Glissez-déposez les **deux** fichiers suivants depuis votre dossier `dist/` :
     1. **`Liquid Dynamic Island-1.0.3-Setup-x64.exe`**
     2. **`latest.yml`**
   - Cliquez sur **Publish release**.

*C'est tout ! L'application de vos utilisateurs détectera la mise à jour au démarrage, la téléchargera et l'installera automatiquement.*

---

## 🗂️ 2. Mettre à jour le Tableau de bord (Obsidian)

Lorsque vous créez un nouveau projet dans `C:\Project Dev\` ou changez le statut d'un projet existant :

1. **Option 1 (Le plus simple)** :
   - Double-cliquez sur le fichier [sync_projects.bat](file:///C:/Users/dylan/Documents/coffre/NALYD/sync_projects.bat) sur votre ordinateur.

2. **Option 2 (Terminal)** :
   - Ouvrez un terminal et exécutez le script avec Python :
     ```powershell
     python "C:\Users\dylan\Documents\coffre\NALYD\sync_projects.py"
     ```

Le script va automatiquement scanner vos projets, importer les nouveaux `README.md`, calculer les dates de modification, et régénérer le [Dashboard.md](file:///C:/Users/dylan/Documents/coffre/NALYD/Dashboard.md).

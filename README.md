# SecurStock — Application Professionnelle de Gestion de Stock (Entreprise de Sécurité)

**SecurStock** est une application web full-stack dédiée à la gestion complète et traçable des stocks de matériel de sécurité, vidéosurveillance, alarmes, contrôle d'accès, protection incendie et EPI.

- **Magasin unique** : Magasin Central de Sécurité (Abidjan)
- **Devise** : **FCFA** (Franc CFA, montants formatés et calculs financiers intègres)
- **Langue** : Français (100% de l'interface et des messages)
- **Base de données persistante** : SQLite avec intégrité référentielle, transactions atomiques et stockage persistant sur disque (`./data/securstock.sqlite`).

---

## 1. Identifiants de Connexion par Défaut

L'application intègre un mécanisme d'authentification sécurisé avec mots de passe hachés via **bcrypt** et jetons de session **JWT** :

| Rôle | Nom | E-mail | Mot de passe |
| :--- | :--- | :--- | :--- |
| **Administrateur** | Aboubacar SIDIBE | `admin@securstock.com` | `Admin@2026` |
| **Magasinier** | Koffi KOUAME | `magasinier@securstock.com` | `Magasin@2026` |

> *Un bouton d'accès rapide en 1 clic est disponible directement sur l'écran de connexion pour faciliter les tests.*

---

## 2. Structure des Modules & Fonctionnalités

### Tableau de bord en temps réel
- Nombre total de références actives.
- Quantité totale d'articles en rayon.
- **Valorisation totale du stock au prix d'achat en FCFA**.
- Compteur de produits en **stock faible** (quantité $\le$ seuil d'alerte).
- Compteur de produits en **rupture de stock** (quantité = 0).
- Entrées et sorties du jour (nombre de mouvements et total d'unités).
- Graphique interactif des volumes des 7 derniers jours (entrées vs sorties).
- Répartition de la valeur du stock par catégorie.
- Liste prioritaire des articles nécessitant un réapprovisionnement urgent.
- Journal des 8 derniers mouvements.

### Gestion du Catalogue Produits
- Champs complets : SKU unique, Code-barres, Nom, Catégorie, Marque, Description, Prix d'achat (FCFA), Prix de vente (FCFA), Stock courant, Seuil d'alerte min, Unité de mesure, Emplacement rayon.
- Filtres avancés : par catégorie, par disponibilité (*Tous, En stock, Stock faible, En rupture, Archivés*).
- Recherche instantanée par nom, référence SKU, code-barres ou marque.
- Tri interactif par colonnes.
- Fiche technique détaillée avec historique individuel des mouvements.
- **Archivage protecteur** : conservation de l'historique sans suppression physique destructrice.
- **Export CSV** : compatible Microsoft Excel (encodage UTF-8 BOM, séparateur point-virgule).
- **Import CSV** : import en masse avec détection des mises à jour ou créations.

### Entrées de Stock (Réceptions Marchandises)
- Numérotation automatique normalisée : `ENT-AAAAMM-XXXX`.
- Sélection de l'article avec visualisation du stock avant/après.
- Quantité reçue ($> 0$), prix d'achat unitaire, fournisseur associé, n° BL/facture, motif.
- Incrémentation atomique et instantanée du stock en base de données.

### Sorties de Stock (Déstockages & Livraisons)
- Numérotation automatique normalisée : `SOR-AAAAMM-XXXX`.
- **Règles de sécurité strictes** : interdiction des sorties supérieures au stock disponible et des quantités négatives/nulles.
- Fenêtre de confirmation obligatoire avant écriture définitive.
- Motifs normalisés : Vente, Installation client, Utilisation interne, Transfert, Produit endommagé, Perte, Retour fournisseur, Autre.
- Décrémentation atomique synchronisée avec le mouvement.

### Inventaire Physique & Régularisations
- Ouverture d'une session d'inventaire (`INV-AAAAMMJJ-XXXX`) avec figeage du stock théorique.
- Feuille de comptage avec saisie des quantités réelles comptées.
- Calcul automatique des écarts : **Surplus (+)** en vert et **Manquants (-)** en rouge.
- Sauvegarde possible en cours de comptage (brouillon).
- **Clôture et régularisation traçable** : génération automatique d'un mouvement `AJUSTEMENT_INVENTAIRE` (`REG-AAAAMM-XXXX`) pour chaque écart constaté. Aucun stock n'est modifié silencieusement.
- Historique complet des inventaires passés.

### Fournisseurs
- Annuaire : Raison sociale, interlocuteur, téléphone, e-mail, adresse physique, conditions.
- Statistiques d'achat et historique de toutes les réceptions rattachées au fournisseur.

### Catégories Spécialisées
13 familles préconfigurées et modifiables par l'administrateur :
1. Caméras de surveillance
2. Enregistreurs DVR et NVR
3. Alarmes anti-intrusion
4. Détecteurs de mouvement et d'ouverture
5. Contrôle d'accès et badges
6. Interphones et visiophones
7. Câbles et connectiques
8. Alimentations et batteries
9. Extincteurs et équipements incendie
10. Équipements de protection individuelle (EPI)
11. Matériel électrique
12. Accessoires et pièces de rechange
13. Autres produits

### Rapports Financiers & Statistiques
- Valorisation globale et par catégorie (coût d'achat, valeur de vente estimée, marge théorique).
- Top 10 des équipements les plus immobilisés en capital.
- Évolution mensuelle des réceptions et déstockages.

### Administration & Sécurité (RBAC)
- Contrôle d'accès par rôle : **Administrateur** et **Magasinier**.
- Gestion des utilisateurs (création, modification, réinitialisation de mot de passe, suppression).
- Changement de mot de passe utilisateur.
- **Journal d'Audit (Audit Trail)** : traçabilité des connexions, créations et mouvements sensibles.
- Sauvegarde globale téléchargeable en JSON.

---

## 3. Guide d'Installation & Lancement

### Prérequis
- Node.js (version 18+)
- npm ou bun

### Installation des dépendances
```bash
npm install
```

### Lancement en mode Développement
```bash
npm run dev
```
L'application démarre sur `http://localhost:3000`.

### Exécution des tests de règles de gestion
```bash
npm run test
```

### Construction et Démarrage Production (Full-Stack)
```bash
npm run build
npm start
```

---

## 4. Sauvegarde et Restauration

### Procédure de Sauvegarde
1. **Via l'interface** : Rendez-vous dans **Paramètres & Sécurité** $\rightarrow$ onglet **Sauvegarde** et cliquez sur *"Télécharger la Sauvegarde Complète (JSON)"*.
2. **Via le système de fichiers** : Copiez le fichier de base de données SQLite :
   ```bash
   cp data/securstock.sqlite data/securstock_backup_$(date +%F).sqlite
   ```

### Procédure de Restauration
1. Arrêtez le serveur applicatif (`Ctrl+C`).
2. Remplacez le fichier `data/securstock.sqlite` par votre fichier de sauvegarde.
3. Relancez le serveur (`npm start`). La cohérence et les tables sont vérifiées à l'initialisation.

# 🖥️ Spécification Complète — Application Admin React

## 🚛 Truck Lifecycle Tracking System

---

## 🎯 1. Objectif de l’application

L’application Admin (React) permet aux administrateurs de :

* Gérer les camions
* Gérer les opérateurs
* Suivre les trajets en temps réel
* Analyser les performances (temps, retards)
* Superviser l’activité globale du système

👉 Toute l’interface utilisateur doit être **en français**

---

## 🎨 2. Identité visuelle

### Couleur principale :

```css
--primary-color: #F2B841;
```

### Recommandations UI :

* Style moderne (dashboard SaaS)
* Fond clair ou dark soft
* Utilisation du jaune comme accent (boutons, highlights)
* Bordures arrondies (8px–12px)
* Icônes simples (Lucide / Material)

---

## 🧱 3. Stack technique

* React (Vite recommandé)
* TypeScript (OBLIGATOIRE)
* Gestion d’état : Zustand ou Redux Toolkit
* UI Library : TailwindCSS + shadcn/ui
* Routing : React Router
* API : Axios
* Charts : Recharts

---

## 🧭 4. Structure du projet

```bash
src/
 ├── api/
 ├── components/
 ├── pages/
 ├── layouts/
 ├── hooks/
 ├── store/
 ├── types/
 ├── utils/
 ├── routes/
```

---

## 🔐 5. Authentification

### Pages :

* `/login`

### Fonctionnalités :

* Connexion avec email + mot de passe
* Stockage token (localStorage)
* Redirection vers dashboard

### Texte UI :

* "Connexion"
* "Email"
* "Mot de passe"
* "Se connecter"

---

## 🧭 6. Layout principal

### Sidebar :

* Tableau de bord
* Camions
* Opérateurs
* Trajets
* Rapports
* Déconnexion

---

# 📊 7. Pages principales

---

## 🏠 7.1 Tableau de bord

### Route :

```bash
/dashboard
```

### Données (API) :

```http
GET /api/reports/summary
```

### Widgets :

* Nombre total de trajets
* Nombre de trajets actifs
* Temps moyen (Entreprise → Port)
* Temps moyen au port
* Temps moyen (Port → Entreprise)

### Graphiques :

* Évolution des trajets (par jour)
* Répartition des durées

---

## 🚛 7.2 Gestion des camions

### Route :

```bash
/trucks
```

### APIs :

```http
GET /api/trucks
POST /api/trucks
PUT /api/trucks/{id}
DELETE /api/trucks/{id}
PATCH /api/trucks/{id}/activate
PATCH /api/trucks/{id}/deactivate
POST /api/trucks/{id}/generate-qr
```

### Fonctionnalités :

* Liste des camions
* Ajouter un camion
* Modifier
* Supprimer
* Activer / désactiver
* Générer QR code

### Champs :

* Numéro d’immatriculation
* Statut (Actif / Inactif)

---

## 👤 7.3 Gestion des opérateurs

### Route :

```bash
/users
```

### APIs :

```http
GET /api/users
POST /api/users
PUT /api/users/{id}
DELETE /api/users/{id}
```

### Fonctionnalités :

* Créer opérateur
* Modifier rôle
* Supprimer
* Filtrer par rôle

### Champs :

* Nom
* Email
* Rôle (ADMIN, COMPANY_OPERATOR, PORT_OPERATOR)
* Localisation (COMPANY / PORT)

---

## 🔄 7.4 Suivi des trajets

### Route :

```bash
/trips
```

### APIs :

```http
GET /api/trips
GET /api/trips/active
GET /api/trips/history
GET /api/trips/{id}
GET /api/trips/{id}/logs
```

### Fonctionnalités :

* Liste des trajets
* Filtrer :

  * Statut
  * Date
  * Camion
* Voir détail d’un trajet

### Détail :

* Heure départ
* Heure arrivée port
* Heure sortie port
* Heure retour
* Durées calculées

---

## 📜 7.5 Logs de scan

### Inclus dans détail trajet

### Données :

```http
GET /api/trips/{id}/logs
```

### Affichage :

* Horodatage
* Action (START, ARRIVE, LEAVE, RETURN)
* Opérateur
* Localisation

---

## 📈 7.6 Rapports

### Route :

```bash
/reports
```

### APIs :

```http
GET /api/reports/summary
GET /api/reports/durations
GET /api/reports/delays
GET /api/reports/export
```

### Fonctionnalités :

* Statistiques globales
* Analyse des retards
* Export (CSV / Excel)

---

# 🧩 8. Composants réutilisables

---

## Table générique

* Pagination
* Filtres
* Recherche

---

## Modal

* Ajout / édition

---

## Card KPI

* Valeur + label

---

## Chart

* Ligne
* Barres

---

# 🔁 9. Gestion des appels API

### Axios config :

* Base URL : `/api`
* Interceptor pour token
* Gestion erreurs globale

---

# 📦 10. Types (TypeScript)

---

## Truck

```ts
id: number
registration_number: string
is_active: boolean
```

---

## Trip

```ts
id: number
status: string
started_at: string
arrived_port_at: string
left_port_at: string
completed_at: string
```

---

## User

```ts
id: number
name: string
email: string
role: string
location: string
```

---

# 🔐 11. Sécurité frontend

* Vérifier token à chaque chargement
* Rediriger si non connecté
* Masquer routes admin

---

# ⚠️ 12. Gestion des erreurs

Afficher en français :

* "Une erreur est survenue"
* "Accès refusé"
* "Données invalides"

---

# 🧪 13. Bonus (Optionnel mais recommandé)

* Mode sombre
* Notifications (toast)
* Rafraîchissement auto des trajets actifs
* WebSocket (temps réel)

---

# 🚀 14. Livrables attendus

L’agent doit générer :

* Structure React complète
* Pages + routing
* Intégration API complète
* UI moderne en français
* Composants réutilisables
* Gestion état + auth

---

# ✅ 15. Critères de réussite

* Interface 100% en français
* Navigation fluide
* Toutes les APIs admin consommées
* Données affichées correctement
* UX propre et moderne

---

## 🧠 FIN — SPEC ADMIN FRONTEND

# Optimus-LMS - Learning Management System

**Auteur:** LIMAME Ghassene  
**Version:** 1.0.0  
**Licence:** MIT

## 📁 Structure du Dépôt

```
LMS-SCORM/
└── optimus-lms-platform/    # Application principale Optimus-LMS
    ├── client/              # Frontend React + TypeScript
    ├── server/              # Backend Express + Node.js
    ├── shared/              # Code partagé
    ├── migrations/          # Migrations de base de données
    ├── scripts/             # Scripts utilitaires
    └── tests/               # Tests unitaires et E2E
```

## 🚀 Démarrage Rapide

```bash
# Aller dans le dossier du projet
cd optimus-lms-platform

# Installer les dépendances
pnpm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# Créer la base de données
createdb optimus_lms_dev

# Lancer les migrations
pnpm run db:push

# Démarrer le serveur de développement
pnpm run dev
```

## 📚 Documentation

- [README Principal](./optimus-lms-platform/README.md) - Documentation complète du projet
- [Configuration Environnement](./optimus-lms-platform/ENV_CONFIGURATION.md) - Guide détaillé des variables
- [Résumé du Renommage](./optimus-lms-platform/RENAMING_SUMMARY.md) - Historique du rebranding
- [Tests](./optimus-lms-platform/TESTING.md) - Guide des tests

## 🎯 Fonctionnalités

- ✅ Plateforme SCORM professionnelle (1.2, 2004, AICC, xAPI)
- ✅ Architecture multi-tenant
- ✅ Gestion avancée des licences
- ✅ Analytics en temps réel avec xAPI
- ✅ Cache Redis pour performances optimales
- ✅ Support CDN (CloudFlare R2 / AWS S3)
- ✅ Tests complets (unitaires + E2E)
- ✅ CI/CD avec GitHub Actions

## 👨‍💻 Développé par

**LIMAME Ghassene**

Plateforme LMS de niveau entreprise conçue pour rivaliser avec les leaders du marché comme Rustici SCORM Cloud.

---

*Dernière mise à jour: 16 novembre 2025*

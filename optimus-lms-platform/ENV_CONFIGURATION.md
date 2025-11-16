# Configuration des Variables d'Environnement

**Projet:** Optimus-LMS Platform  
**Auteur:** LIMAME Ghassene

## Vue d'Ensemble

Le projet Optimus-LMS utilise plusieurs fichiers `.env` pour différents environnements :

| Fichier | Usage | Description |
|---------|-------|-------------|
| `.env` | **Production** | Configuration Replit/production |
| `.env.local` | **Développement** | Configuration locale |
| `.env.test` | **Tests** | Configuration pour tests automatisés |
| `.env.example` | **Template** | Modèle de référence |

---

## 🚀 Configuration Rapide

### 1. Production (Replit)

Le fichier `.env` est **déjà configuré** avec :
- ✅ Redis Cloud (credentials production)
- ✅ Public domain Replit
- ⚠️ À configurer : `DATABASE_URL`, `SESSION_SECRET`

**Actions requises :**

```bash
# 1. Générer une clé de session sécurisée
openssl rand -base64 32

# 2. Remplacer dans .env :
SESSION_SECRET=<clé_générée>

# 3. Configurer votre base de données PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/optimus_lms
```

### 2. Développement Local

Utilisez `.env.local` :

```bash
# Copier le fichier de développement
cp .env.local .env

# Créer la base de données locale
createdb optimus_lms_dev

# Lancer les migrations
pnpm run db:push

# Démarrer le serveur
pnpm run dev
```

### 3. Tests

Le fichier `.env.test` est utilisé automatiquement par Vitest et Playwright.

```bash
# Créer la base de données de test
createdb optimus_lms_test

# Exécuter les tests
pnpm test
```

---

## 📦 Variables par Catégorie

### 🔴 OBLIGATOIRES (Production)

Ces variables **doivent** être configurées pour la production :

```env
# Base de données
DATABASE_URL=postgresql://user:password@host:5432/optimus_lms

# Sécurité de session (générer avec: openssl rand -base64 32)
SESSION_SECRET=votre_cle_secrete_64_caracteres

# Domaine public (pour exports SCORM)
PUBLIC_DOMAIN=https://yourapp.replit.app

# Domaines Replit autorisés
REPLIT_DOMAINS=yourapp.replit.app,custom-domain.com

# Port
PORT=5000
```

### 🟢 REDIS CLOUD (Production - Déjà configuré ✅)

```env
# Credentials Redis Cloud (PRODUCTION READY)
REDIS_HOST=redis-15601.crce202.eu-west-3-1.ec2.cloud.redislabs.com
REDIS_PORT=15601
REDIS_PASSWORD=8vZCXuFFWkHgpWOepI9Oqgr2VGry7lCo
REDIS_USERNAME=default

# Cache TTL (secondes)
CACHE_TTL_DEFAULT=300
CACHE_TTL_SESSION=3600
CACHE_TTL_COURSES=600
CACHE_TTL_TENANTS=3600
CACHE_TTL_MANIFESTS=3600
```

**Test de connexion :**

```bash
pnpm run dev
# Vérifier les logs :
# ✅ Redis Cloud connected successfully
# 📍 Connected to: redis-15601.crce202...
```

### 🔵 STORAGE & CDN (Optionnel)

#### Option 1 : Local Storage (Par défaut)

```env
STORAGE_PROVIDER=local
UPLOADS_DIR=./uploads
```

#### Option 2 : CloudFlare R2 (Recommandé pour production)

```env
STORAGE_PROVIDER=cloudflare-r2

# CloudFlare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=votre_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=votre_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=votre_secret_key
CLOUDFLARE_R2_BUCKET_NAME=optimus-lms-courses
CLOUDFLARE_R2_CDN_DOMAIN=cdn.yourdomain.com

# Cache purging (optionnel)
CLOUDFLARE_ZONE_ID=votre_zone_id
CLOUDFLARE_API_TOKEN=votre_api_token
```

**Setup CloudFlare R2 :**

1. Créer compte : https://www.cloudflare.com/products/r2/
2. Créer bucket : `optimus-lms-courses`
3. Générer API Token R2 (Read & Write)
4. Configurer custom domain CDN

#### Option 3 : AWS S3 + CloudFront

```env
STORAGE_PROVIDER=s3-cloudfront

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=votre_access_key
AWS_SECRET_ACCESS_KEY=votre_secret_key
AWS_S3_BUCKET_NAME=optimus-lms-courses
AWS_CLOUDFRONT_DOMAIN=d123456789.cloudfront.net
AWS_CLOUDFRONT_DISTRIBUTION_ID=E123456789ABCD
```

### 🟡 SÉCURITÉ (Optionnel mais recommandé)

```env
# Encryption key (générer avec: openssl rand -hex 32)
ENCRYPTION_KEY=votre_cle_64_caracteres_hexadecimaux

# Rate Limiting (valeurs par défaut)
RATE_LIMIT_AUTH_ATTEMPTS=5
RATE_LIMIT_AUTH_WINDOW=900000
RATE_LIMIT_UPLOAD_MAX=20
RATE_LIMIT_UPLOAD_WINDOW=3600000
```

### 🟣 MONITORING & LOGGING

```env
# Log Level (error | warn | info | debug)
LOG_LEVEL=info

# Audit Logging
ENABLE_AUDIT_LOG=true
```

### 🟠 FEATURE FLAGS

```env
# Activer/Désactiver fonctionnalités
ENABLE_CDN=false
ENABLE_XAPI_TRACKING=true
ENABLE_LICENSE_ENFORCEMENT=true
```

---

## 🔧 Configuration par Environnement

### 📍 Production (Replit)

**Fichier : `.env`**

```env
NODE_ENV=production
DATABASE_URL=<PostgreSQL_Production>
SESSION_SECRET=<Générer_avec_openssl>
PUBLIC_DOMAIN=https://sun-scorm-manager-dscalessa1010.replit.app
REDIS_HOST=redis-15601.crce202.eu-west-3-1.ec2.cloud.redislabs.com
REDIS_PORT=15601
REDIS_PASSWORD=8vZCXuFFWkHgpWOepI9Oqgr2VGry7lCo
STORAGE_PROVIDER=local
LOG_LEVEL=info
ENABLE_AUDIT_LOG=true
```

### 💻 Développement Local

**Fichier : `.env.local` → copier vers `.env`**

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/optimus_lms_dev
SESSION_SECRET=dev-secret-key-not-for-production
PUBLIC_DOMAIN=http://localhost:5000
REDIS_HOST=localhost
REDIS_PORT=6379
STORAGE_PROVIDER=local
LOG_LEVEL=debug
```

### 🧪 Tests

**Fichier : `.env.test` (automatique)**

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:test@localhost:5432/optimus_lms_test
SESSION_SECRET=test-secret-key-for-testing-only
DISABLE_EXTERNAL_SERVICES=true
LOG_LEVEL=error
```

---

## 📊 Matrice de Configuration

| Variable | Production | Dev Local | Tests |
|----------|-----------|-----------|-------|
| `NODE_ENV` | production | development | test |
| `DATABASE_URL` | PostgreSQL prod | PostgreSQL local | PostgreSQL test |
| `REDIS_HOST` | Redis Cloud | localhost/Cloud | localhost |
| `SESSION_SECRET` | **Sécurisé** | dev-only | test-only |
| `PUBLIC_DOMAIN` | Replit URL | localhost:5000 | localhost:5000 |
| `STORAGE_PROVIDER` | local/r2 | local | local |
| `LOG_LEVEL` | info/warn | debug | error |
| `ENABLE_AUDIT_LOG` | true | false | false |

---

## 🛠️ Commandes Utiles

### Générer des Secrets

```bash
# Session Secret (32 bytes base64)
openssl rand -base64 32

# Encryption Key (32 bytes hex)
openssl rand -hex 32

# API Key (random string)
openssl rand -base64 24
```

### Vérifier la Configuration

```bash
# Afficher les variables (sans valeurs sensibles)
pnpm run dev | grep "✅"

# Tester la connexion Redis
pnpm run dev
# Chercher : "✅ Redis connected successfully"

# Tester la base de données
pnpm run db:push

# Health check complet
curl http://localhost:5000/health/detailed
```

### Debugging

```bash
# Voir toutes les variables chargées (DEV ONLY)
node -e "require('dotenv').config(); console.log(process.env)"

# Tester Redis manuellement
redis-cli -h redis-15601.crce202.eu-west-3-1.ec2.cloud.redislabs.com \
  -p 15601 -a 8vZCXuFFWkHgpWOepI9Oqgr2VGry7lCo \
  PING

# Tester PostgreSQL
psql "$DATABASE_URL" -c "SELECT 1"
```

---

## 🚨 Sécurité

### ⚠️ Ne JAMAIS committer

```bash
# Ajouter à .gitignore (déjà fait)
.env
.env.local
.env.production
*.env.backup
```

### ✅ Bonnes Pratiques

1. **Rotation des secrets** : Changer `SESSION_SECRET` régulièrement
2. **Principe du moindre privilège** : Limiter les accès database/Redis
3. **Secrets Manager** : Utiliser Replit Secrets ou AWS Secrets Manager
4. **Audit** : Activer `ENABLE_AUDIT_LOG=true` en production
5. **HTTPS uniquement** : Toujours `PUBLIC_DOMAIN=https://...`

### 🔒 Variables Sensibles

| Variable | Sensibilité | Action |
|----------|-------------|--------|
| `SESSION_SECRET` | 🔴 Critique | Générer aléatoirement, jamais en clair |
| `REDIS_PASSWORD` | 🔴 Critique | Ne pas partager, rotation régulière |
| `DATABASE_URL` | 🔴 Critique | Contient credentials, protéger |
| `ENCRYPTION_KEY` | 🔴 Critique | Changer = données illisibles |
| `CLOUDFLARE_API_TOKEN` | 🟠 Important | Limiter les scopes |
| `AWS_SECRET_ACCESS_KEY` | 🟠 Important | IAM avec permissions minimales |

---

## 📚 Documentation Associée

- **Redis** : `REDIS_CACHING.md` - Configuration Redis Cloud
- **CDN** : `CDN_INTEGRATION.md` - Setup CloudFlare R2 / AWS
- **Sécurité** : `SECURITY.md` - Audit logging, encryption
- **Tests** : `TESTING.md` - Configuration environnement de test
- **Migration** : `PNPM_MIGRATION.md` - Setup pnpm

---

## ✅ Checklist de Configuration

### Production (Minimal)

- [ ] Copier `.env.example` vers `.env`
- [ ] Configurer `DATABASE_URL`
- [ ] Générer et configurer `SESSION_SECRET`
- [ ] Vérifier `PUBLIC_DOMAIN`
- [ ] Tester connexion Redis (déjà configuré ✅)
- [ ] Exécuter `pnpm run db:push`
- [ ] Démarrer : `pnpm run dev`

### Production (Complet)

- [ ] Configuration minimale ci-dessus
- [ ] Générer `ENCRYPTION_KEY`
- [ ] Configurer CloudFlare R2 ou AWS S3
- [ ] Activer `ENABLE_AUDIT_LOG=true`
- [ ] Configurer `LOG_LEVEL=warn`
- [ ] Tester tous les endpoints
- [ ] Vérifier health checks
- [ ] Build : `pnpm run build`

### Développement Local

- [ ] Copier `.env.local` vers `.env`
- [ ] Installer PostgreSQL local
- [ ] Créer database : `createdb optimus_lms_dev`
- [ ] (Optionnel) Installer Redis local
- [ ] Exécuter `pnpm run db:push`
- [ ] Démarrer : `pnpm run dev`

### Tests

- [ ] Créer database test : `createdb optimus_lms_test`
- [ ] Vérifier `.env.test` configuré
- [ ] Exécuter : `pnpm test`
- [ ] Vérifier coverage : `pnpm run test:coverage`

---

## 🆘 Dépannage

### Erreur : "Redis connection failed"

```bash
# Vérifier credentials Redis
echo $REDIS_HOST
echo $REDIS_PORT

# Tester manuellement
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD PING

# L'app fonctionne sans Redis (fallback PostgreSQL)
```

### Erreur : "Database connection failed"

```bash
# Vérifier format DATABASE_URL
echo $DATABASE_URL
# Doit être : postgresql://user:pass@host:port/db

# Tester connexion
psql "$DATABASE_URL" -c "SELECT version()"

# Vérifier que la DB existe
psql "$DATABASE_URL" -c "\dt"
```

### Variables non chargées

```bash
# Vérifier que .env existe
ls -la .env

# Vérifier le format (pas d'espaces autour du =)
cat .env | grep "="

# Recharger
pnpm run dev
```

---

## 📞 Support

Pour plus d'aide :
- 📖 Documentation complète dans `/docs`
- 🔍 Issues GitHub
- 💬 Support équipe

---

**Dernière mise à jour** : 16 novembre 2025  
**Version** : 1.0.0  
**Status** : ✅ Production Ready

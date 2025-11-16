#!/bin/bash

# ==============================================
# Environment Configuration Validator
# ==============================================
# Validates .env configuration for Optimus-LMS Platform
# Author: LIMAME Ghassene

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}🔍 Optimus-LMS Environment Configuration Validator${NC}"
echo "=================================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo ""
    echo "Please create .env from one of these templates:"
    echo "  - Production:  cp .env.example .env"
    echo "  - Development: cp .env.local .env"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Load .env
export $(cat .env | grep -v '^#' | xargs)

# Validation counters
CRITICAL_ISSUES=0
WARNINGS=0
OK_COUNT=0

echo "🔴 CRITICAL VARIABLES (Required for production)"
echo "------------------------------------------------"

# DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set${NC}"
    echo "   Set: DATABASE_URL=postgresql://user:password@host:5432/database"
    ((CRITICAL_ISSUES++))
elif [[ "$DATABASE_URL" == *"your_database_url"* ]]; then
    echo -e "${RED}❌ DATABASE_URL contains placeholder${NC}"
    echo "   Replace with actual PostgreSQL connection string"
    ((CRITICAL_ISSUES++))
else
    echo -e "${GREEN}✅ DATABASE_URL configured${NC}"
    ((OK_COUNT++))
fi

# SESSION_SECRET
if [ -z "$SESSION_SECRET" ]; then
    echo -e "${RED}❌ SESSION_SECRET not set${NC}"
    echo "   Generate: openssl rand -base64 32"
    ((CRITICAL_ISSUES++))
elif [[ "$SESSION_SECRET" == *"CHANGE_ME"* ]] || [[ "$SESSION_SECRET" == *"dev-secret"* ]]; then
    echo -e "${RED}❌ SESSION_SECRET using insecure default${NC}"
    echo "   Generate: openssl rand -base64 32"
    ((CRITICAL_ISSUES++))
else
    echo -e "${GREEN}✅ SESSION_SECRET configured${NC}"
    ((OK_COUNT++))
fi

# PUBLIC_DOMAIN
if [ -z "$PUBLIC_DOMAIN" ]; then
    echo -e "${RED}❌ PUBLIC_DOMAIN not set${NC}"
    echo "   Set: PUBLIC_DOMAIN=https://yourapp.replit.app"
    ((CRITICAL_ISSUES++))
else
    echo -e "${GREEN}✅ PUBLIC_DOMAIN configured: $PUBLIC_DOMAIN${NC}"
    ((OK_COUNT++))
fi

echo ""
echo "🟢 REDIS CONFIGURATION (Recommended)"
echo "------------------------------------------------"

# Redis
if [ -z "$REDIS_HOST" ]; then
    echo -e "${YELLOW}⚠️  REDIS_HOST not set (will use PostgreSQL fallback)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ REDIS_HOST configured: $REDIS_HOST${NC}"
    ((OK_COUNT++))
    
    if [ -z "$REDIS_PASSWORD" ]; then
        echo -e "${YELLOW}⚠️  REDIS_PASSWORD not set${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ REDIS_PASSWORD configured${NC}"
        ((OK_COUNT++))
    fi
fi

echo ""
echo "🔵 STORAGE & CDN (Optional)"
echo "------------------------------------------------"

# Storage Provider
if [ -z "$STORAGE_PROVIDER" ]; then
    echo -e "${YELLOW}⚠️  STORAGE_PROVIDER not set (defaults to 'local')${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ STORAGE_PROVIDER: $STORAGE_PROVIDER${NC}"
    ((OK_COUNT++))
    
    # Check CDN-specific configs
    if [ "$STORAGE_PROVIDER" = "cloudflare-r2" ]; then
        if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
            echo -e "${RED}❌ CLOUDFLARE_ACCOUNT_ID required for R2${NC}"
            ((CRITICAL_ISSUES++))
        else
            echo -e "${GREEN}✅ CloudFlare R2 configured${NC}"
            ((OK_COUNT++))
        fi
    fi
fi

echo ""
echo "🟡 SECURITY & FEATURES (Optional but recommended)"
echo "------------------------------------------------"

# Encryption Key
if [ -z "$ENCRYPTION_KEY" ]; then
    echo -e "${YELLOW}⚠️  ENCRYPTION_KEY not set (will use default - NOT secure)${NC}"
    echo "   Generate: openssl rand -hex 32"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ ENCRYPTION_KEY configured${NC}"
    ((OK_COUNT++))
fi

# Log Level
if [ -z "$LOG_LEVEL" ]; then
    echo -e "${YELLOW}⚠️  LOG_LEVEL not set (defaults to 'info')${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ LOG_LEVEL: $LOG_LEVEL${NC}"
    ((OK_COUNT++))
fi

echo ""
echo "=================================================="
echo -e "${BOLD}📊 VALIDATION SUMMARY${NC}"
echo "=================================================="
echo ""

if [ $CRITICAL_ISSUES -gt 0 ]; then
    echo -e "${RED}❌ $CRITICAL_ISSUES critical issue(s) found${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s)${NC}"
fi

echo -e "${GREEN}✅ $OK_COUNT configuration(s) OK${NC}"
echo ""

# Final verdict
if [ $CRITICAL_ISSUES -gt 0 ]; then
    echo -e "${RED}🚫 Configuration NOT ready for production${NC}"
    echo ""
    echo "Fix critical issues above before deploying."
    echo "See ENV_CONFIGURATION.md for detailed setup guide."
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration usable but has warnings${NC}"
    echo ""
    echo "Consider addressing warnings for production deployment."
    echo "See ENV_CONFIGURATION.md for recommendations."
    echo ""
    exit 0
else
    echo -e "${GREEN}🎉 Configuration looks good!${NC}"
    echo ""
    echo "You're ready to deploy. Next steps:"
    echo "  1. pnpm run db:push    # Run migrations"
    echo "  2. pnpm test           # Run tests"
    echo "  3. pnpm run build      # Build for production"
    echo "  4. pnpm run start      # Start server"
    echo ""
    exit 0
fi

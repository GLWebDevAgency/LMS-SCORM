#!/bin/bash

# Détection de l'utilisation de npm au lieu de pnpm

if [[ "$0" == *"npm"* ]] || [[ "$1" == "install" ]] || [[ "$1" == "i" ]]; then
  echo ""
  echo "❌ Ce projet utilise pnpm, pas npm !"
  echo ""
  echo "🔧 Commande à utiliser :"
  echo ""
  
  if [[ "$1" == "install" ]] || [[ "$1" == "i" ]]; then
    echo "   pnpm install"
  elif [[ "$1" == "run" ]]; then
    echo "   pnpm run $2"
  else
    echo "   pnpm $@"
  fi
  
  echo ""
  echo "📚 Guide complet : PNPM_MIGRATION.md"
  echo ""
  exit 1
fi

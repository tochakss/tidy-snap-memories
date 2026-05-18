#!/bin/bash

# ============================================================
#  TidySnaps — Git Push Script
#  Run this from your project root:
#  cd /Users/sasi/Documents/TidySnaps/LovableUI/tidy-snap-memories
#  bash push_to_git.sh "your commit message"
# ============================================================

set -e  # Stop on any error

PROJECT_DIR="/Users/sasi/Documents/TidySnaps/LovableUI/tidy-snap-memories"
BRANCH="main"

# ── Colors for output ──────────────────────────────────────
GREEN='\033[0;32m'
AMBER='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  TidySnaps — Pushing to GitHub${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Step 1: Navigate to project ────────────────────────────
echo -e "${AMBER}[1/6] Navigating to project folder...${NC}"
cd "$PROJECT_DIR" || { echo -e "${RED}Error: Project folder not found at $PROJECT_DIR${NC}"; exit 1; }
echo -e "${GREEN}✓ In: $(pwd)${NC}"
echo ""

# ── Step 2: Check git status ───────────────────────────────
echo -e "${AMBER}[2/6] Checking git status...${NC}"
git status --short
echo ""

# ── Step 3: Ensure .gitignore is clean ────────────────────
echo -e "${AMBER}[3/6] Checking .gitignore...${NC}"
GITIGNORE=".gitignore"

add_if_missing() {
  grep -qF "$1" "$GITIGNORE" 2>/dev/null || echo "$1" >> "$GITIGNORE"
}

add_if_missing "backend/__pycache__/"
add_if_missing "backend/*.pyc"
add_if_missing "backend/*.db"
add_if_missing "backend/.env"
add_if_missing "backend/scores.json"
add_if_missing "backend/enrichment_cache.json"
add_if_missing ".DS_Store"
add_if_missing "dist/"
add_if_missing "*.lockb"

echo -e "${GREEN}✓ .gitignore is clean${NC}"
echo ""

# ── Step 4: Stage all changes ─────────────────────────────
echo -e "${AMBER}[4/6] Staging all changes...${NC}"
git add .
echo -e "${GREEN}✓ All changes staged${NC}"
echo ""

# ── Step 5: Commit ────────────────────────────────────────
echo -e "${AMBER}[5/6] Committing...${NC}"

# Use argument as commit message, or default
if [ -n "$1" ]; then
  COMMIT_MSG="$1"
else
  COMMIT_MSG="feat: update TidySnaps — $(date '+%Y-%m-%d %H:%M')"
fi

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo -e "${AMBER}⚠ Nothing to commit — working tree is clean${NC}"
  echo ""
else
  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}✓ Committed: \"$COMMIT_MSG\"${NC}"
  echo ""
fi

# ── Step 6: Push to GitHub ────────────────────────────────
echo -e "${AMBER}[6/6] Pushing to GitHub (${BRANCH})...${NC}"
git push origin "$BRANCH"
echo ""

# ── Done ──────────────────────────────────────────────────
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Successfully pushed to GitHub!${NC}"
echo -e "${GREEN}  Cloudflare will auto-deploy in ~2 minutes.${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Live site: ${BLUE}https://tidysnaps.com${NC}"
echo -e "  GitHub:    ${BLUE}https://github.com/tochakss/tidy-snap-memories${NC}"
echo ""

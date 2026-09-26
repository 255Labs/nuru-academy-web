#!/usr/bin/env bash
# ============================================================================
# run-all-migrations.sh
# Runs all Nuru migrations in order against your Supabase project.
#
# Usage:
#   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
#   bash supabase/run-all-migrations.sh
#
# Or pass the DB URL as an argument:
#   bash supabase/run-all-migrations.sh "postgresql://..."
# ============================================================================
set -euo pipefail

DB_URL="${1:-$SUPABASE_DB_URL}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: No DB URL. Set SUPABASE_DB_URL or pass as argument."
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/migrations"

echo "Running migrations from: $MIGRATIONS_DIR"
echo ""

for f in "$MIGRATIONS_DIR"/*.sql; do
  name=$(basename "$f")
  echo "▶  $name"
  psql "$DB_URL" -f "$f" --single-transaction -v ON_ERROR_STOP=1
  echo "✓  $name done"
  echo ""
done

echo "============================================"
echo "All migrations complete."
echo "============================================"

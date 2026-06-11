#!/usr/bin/env bash
# Usage: DB_PASSWORD=<your-db-password> bash scripts/apply-migrations.sh
set -e

PROJECT_REF="mljpnekyqipeoycujtim"
DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo "Applying migrations to $PROJECT_REF..."

for f in supabase/migrations/0000*.sql; do
  echo "→ $f"
  psql "$DB_URL" -f "$f"
done

echo "✓ All migrations applied"

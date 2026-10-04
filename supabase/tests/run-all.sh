#!/usr/bin/env bash
# Run every SQL suite in supabase/tests against its own freshly reset local
# database. Each suite assumes seed data and no carts/orders, so sharing one
# database between suites makes them interfere with each other.
#
#   bash supabase/tests/run-all.sh
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

container=supabase_db_Kames-Bookstore
suites=(
  phase2_schema_tests
  phase3_rls_tests
  phase4_catalog_tests
  phase6_cart_tests
  phase7_wishlist_tests
  phase8_order_tests
  phase9_admin_tests
  phase9b_admin_backoffice_tests
  phase12_hardening_tests
)

failed=()
for suite in "${suites[@]}"; do
  echo "--- resetting database for $suite"
  if ! pnpm exec supabase db reset >"/tmp/kames-db-$suite.reset.log" 2>&1; then
    echo "FAIL $suite (db reset, see /tmp/kames-db-$suite.reset.log)"
    failed+=("$suite")
    continue
  fi
  if docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      <"supabase/tests/$suite.sql" >"/tmp/kames-db-$suite.log" 2>&1; then
    echo "PASS $suite"
  else
    echo "FAIL $suite (see /tmp/kames-db-$suite.log)"
    tail -5 "/tmp/kames-db-$suite.log" | sed 's/^/     /'
    failed+=("$suite")
  fi
done

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "ALL DATABASE SUITES PASSED (${#suites[@]})"
else
  echo "FAILED SUITES: ${failed[*]}"
  exit 1
fi

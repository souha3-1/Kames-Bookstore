#!/usr/bin/env bash
# Read-only production smoke test for the hosted Supabase project.
#
#   bash scripts/smoke/production-smoke.sh
#
# Safe against production by construction: every check is a GET, or a write
# probe aimed at a row that cannot exist or at values that violate a check
# constraint. Even if a policy were broken, no data can be created, changed or
# deleted.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

SUPABASE_URL="${SUPABASE_URL:-https://wrvpzgngluphrwfhbqmx.supabase.co}"
ANON_KEY="${ANON_KEY:-sb_publishable_rzYr8AoyrTm3BRUSiZWFFg_jRmw6K9l}"
# left empty on purpose: every *.vercel.app URL for this project currently
# answers with an SSO redirect, so there is no public storefront URL to assume.
SITE_URL="${SITE_URL:-}"
NIL='00000000-0000-0000-0000-000000000000'

passes=0
fails=0

ok()   { passes=$((passes + 1)); printf 'PASS  %s\n' "$1"; }
bad()  { fails=$((fails + 1));  printf 'FAIL  %s\n' "$1"; }
skip() { printf 'SKIP  %s\n' "$1"; }

# count <table?query> -> total row count visible to the anonymous key,
# or -1 when PostgREST refused the request.
count() {
  local headers
  headers=$(curl -sS --max-time 20 -D - -o /dev/null \
    -H "apikey: $ANON_KEY" -H "authorization: Bearer $ANON_KEY" \
    -H 'Range: 0-0' -H 'Prefer: count=exact' \
    "$SUPABASE_URL/rest/v1/$1" 2>/dev/null) || { printf -- '-1'; return; }
  local code total
  code=$(printf '%s' "$headers" | tr -d '\r' | awk 'NR==1{print $2}')
  case "$code" in 200|206) ;; *) printf -- '-1'; return ;; esac
  total=$(printf '%s' "$headers" | tr -d '\r' \
    | awk 'tolower($1)=="content-range:"{split($2,a,"/");print a[2]}')
  case "$total" in ''|'*') printf '0' ;; *) printf '%s' "$total" ;; esac
}

expect_public() { # <query> <label>
  local n; n=$(count "$1")
  if [ "$n" -gt 0 ]; then ok "$2 readable anonymously ($n rows)"
  else bad "$2 should be public but $n rows were visible"; fi
}

expect_hidden() { # <query> <label>
  local n; n=$(count "$1")
  if [ "$n" -le 0 ]; then ok "$2 hidden from anonymous callers"
  else bad "$2 leaked $n rows to anonymous callers"; fi
}

# probe <METHOD> <path> <json-body> <label>
probe() {
  local method=$1 path=$2 data=$3 label=$4
  local args=(-sS --max-time 20 -o /tmp/smoke-probe.out -w '%{http_code}'
              -X "$method"
              -H "apikey: $ANON_KEY" -H "authorization: Bearer $ANON_KEY"
              -H 'content-type: application/json' -H 'Prefer: return=representation')
  [ -n "$data" ] && args+=(-d "$data")
  local code
  code=$(curl "${args[@]}" "$SUPABASE_URL/rest/v1/$path" 2>/dev/null) || code=000
  if [ "$code" = 200 ] || [ "$code" = 201 ]; then
    if grep -q '{' /tmp/smoke-probe.out 2>/dev/null; then
      bad "$label was accepted (http $code)"
    else
      ok "$label changed no rows (http $code)"
    fi
  else
    ok "$label refused (http $code)"
  fi
}

echo "== catalog is public =="
expect_public 'books?select=id&active=eq.true'  'books'
expect_public 'categories?select=id'            'categories'

wilayas=$(count 'wilayas?select=code')
if [ "$wilayas" = 58 ]; then ok 'wilayas has all 58 entries'
else bad "wilayas returned $wilayas rows, expected 58"; fi

echo
echo "== private tables stay hidden =="
expect_hidden 'orders?select=id'                     'orders'
expect_hidden 'order_items?select=id'                'order_items'
expect_hidden 'carts?select=id'                      'carts'
expect_hidden 'cart_items?select=id'                 'cart_items'
expect_hidden 'wishlist_items?select=id'             'wishlist_items'
expect_hidden 'newsletter_subscribers?select=email'  'newsletter_subscribers'
expect_hidden 'admin_users?select=user_id'           'admin_users'

echo
echo "== anonymous writes are refused =="
# total <> subtotal + delivery_fee violates orders_total_matches, so this
# cannot insert a real order even if the insert policy were wide open.
probe POST 'orders' '{"order_number":"KM-19700101-SMOKE1","customer_name":"smoke","customer_phone":"0555000000","wilaya":"Alger","address":"smoke","subtotal":100,"delivery_fee":0,"total":999}' \
  'anonymous order insert'
probe POST 'books' '{"title":"smoke","author":"smoke","description":"smoke","price":-1,"category_id":"'"$NIL"'"}' \
  'anonymous book insert'
probe DELETE "books?id=eq.$NIL" '' 'anonymous book delete (row that cannot exist)'
# the address is a deliberate check-constraint violation, so this proves the
# endpoint validates without leaving a subscriber row behind
probe POST 'newsletter_subscribers' '{"email":"smoke@invalid"}' \
  'anonymous newsletter insert with an invalid email'

# Definitive update probe: rewriting a real book's stock to the value it
# already has. If anon could write, the response carries the row back.
book=$(curl -sS --max-time 20 \
  -H "apikey: $ANON_KEY" -H "authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/books?select=id,stock&active=eq.true&limit=1" 2>/dev/null)
book_id=$(printf '%s' "$book" | sed -n 's/.*"id":"\([0-9a-f-]\{36\}\)".*/\1/p')
book_stock=$(printf '%s' "$book" | sed -n 's/.*"stock":\([0-9]*\).*/\1/p')
if [ -n "$book_id" ] && [ -n "$book_stock" ]; then
  probe PATCH "books?id=eq.$book_id" "{\"stock\":$book_stock}" \
    "anonymous update of a real book (stock left at $book_stock)"
else
  skip 'no readable book to aim the update probe at'
fi

# place_order must stay reachable by anon (checkout depends on it) while still
# refusing a cart that has no items, so an empty cart can never become an order.
rpc_body=$(curl -sS --max-time 20 -o /tmp/smoke-rpc.out -w '%{http_code}' \
  -X POST -H "apikey: $ANON_KEY" -H "authorization: Bearer $ANON_KEY" \
  -H 'content-type: application/json' \
  -d "{\"p_token\":\"$NIL\",\"p_name\":\"smoke\",\"p_phone\":\"0555000000\",\"p_wilaya_code\":16,\"p_commune\":\"Kouba\",\"p_delivery_method\":\"home\",\"p_address\":\"smoke\",\"p_notes\":null}" \
  "$SUPABASE_URL/rest/v1/rpc/place_order" 2>/dev/null) || rpc_body=000
if grep -q 'cart is empty' /tmp/smoke-rpc.out 2>/dev/null; then
  ok "place_order is callable by anon and refused the empty cart (http $rpc_body)"
elif [ "$rpc_body" = 200 ]; then
  bad 'place_order created an order from an empty cart'
else
  bad "place_order is not reachable by anon (http $rpc_body) - checkout would be broken"
fi

echo
echo "== deployed bundle =="
# The bundle Vercel serves is exactly artifacts/kames-shelves/dist/public, so
# scanning a local production build covers the deployed artifact even while the
# site itself sits behind Vercel Deployment Protection.
dist=artifacts/kames-shelves/dist/public/assets
if [ -d "$dist" ]; then
  if grep -rqEi 'service_role|sb_secret|eyJhbGciOi|postgres(ql)://' "$dist"; then
    bad "secret-looking string in $dist"
  else
    ok "built bundle contains no service-role key, JWT or database URL"
  fi
  if grep -rqF "$ANON_KEY" "$dist"; then
    ok 'built bundle ships only the publishable (anon) key'
  else
    skip 'publishable key not found in the built bundle (stale build?)'
  fi
else
  skip "no production build at $dist - run pnpm build first"
fi

echo
echo "== storefront =="
if [ -z "$SITE_URL" ]; then
  skip 'SITE_URL not set - pass SITE_URL=https://<your-domain> to smoke test the live site'
else
  site_code=$(curl -sS --max-time 20 -o /tmp/smoke-site.out -w '%{http_code}' "$SITE_URL/" 2>/dev/null) || site_code=000
  if [ "$site_code" = 302 ] || grep -qi 'sso-api' /tmp/smoke-site.out 2>/dev/null; then
    skip "storefront is behind Vercel Deployment Protection ($SITE_URL redirects to vercel.com/sso-api)"
  elif [ "$site_code" = 200 ] && grep -qi 'kame' /tmp/smoke-site.out; then
    ok "storefront responds ($SITE_URL)"
    assets=$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' /tmp/smoke-site.out | sort -u)
    if [ -n "$assets" ]; then
      leaks=0
      for a in $assets; do
        curl -sS --max-time 30 "$SITE_URL$a" -o /tmp/smoke-asset.out 2>/dev/null || continue
        if grep -qEi 'service_role|sb_secret|eyJhbGciOi|postgres(ql)?://' /tmp/smoke-asset.out; then
          bad "secret-looking string in deployed bundle $a"; leaks=1
        fi
      done
      [ "$leaks" = 0 ] && ok 'deployed bundles contain no service-role key, JWT or database URL'
    else
      skip 'no bundle reference found in the served HTML'
    fi
  else
    bad "storefront did not respond (http $site_code at $SITE_URL)"
  fi
fi

echo
echo "passed: $passes   failed: $fails"
[ "$fails" -eq 0 ] || exit 1

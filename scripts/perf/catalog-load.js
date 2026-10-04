// Phase 12 performance harness: read-only load profiles for the catalog API.
//
// Every request in this file is a GET against public, cacheable read endpoints.
// There is no write path here on purpose: no cart mutation, no place_order, no
// stock change, so a run can never create a real order or send a notification.
//
// Usage (local Docker stack, the only target for load profiles):
//   ANON_KEY=$(pnpm exec supabase status -o env | sed -n 's/^ANON_KEY=//p') \
//     k6 run -e PROFILE=ladder scripts/perf/catalog-load.js
//
// Profiles: ladder (1 -> 5 -> 10 -> 25 -> 50 -> 100 VU), spike, soak, smoke.
// The smoke profile is the only one allowed against the hosted project.

import http from 'k6/http';
import { check } from 'k6';

const TARGET = (__ENV.TARGET || 'http://127.0.0.1:54321').replace(/\/$/, '');
const PROFILE = __ENV.PROFILE || 'ladder';
const ANON_KEY = __ENV.ANON_KEY || '';

const HOSTED_PROJECT = 'wrvpzgngluphrwfhbqmx.supabase.co';
const targetsHosted = TARGET.includes(HOSTED_PROJECT);

if (!ANON_KEY) {
  throw new Error('ANON_KEY is required (local: `supabase status -o env`, hosted: the publishable key)');
}
if (targetsHosted && PROFILE !== 'smoke') {
  throw new Error(
    `refusing to run the "${PROFILE}" profile against the hosted project; ` +
      'load profiles are local-only, use PROFILE=smoke for production',
  );
}

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  Accept: 'application/json',
};

const QUERIES = {
  categories: '/rest/v1/categories?select=id,name,slug&active=eq.true&order=name.asc',
  books:
    '/rest/v1/books?select=id,title,author,price,format,pages,featured&active=eq.true&order=created_at.desc&limit=8',
  bookDetail: '/rest/v1/books?select=id,title,description,price,stock&active=eq.true&limit=1',
  wilayas: '/rest/v1/wilayas?select=code,name&order=code.asc',
};

const SCENARIOS = {
  // progressive ladder, capped at 100 VU
  ladder: {
    stages: [
      { duration: '20s', target: 1 },
      { duration: '30s', target: 5 },
      { duration: '45s', target: 10 },
      { duration: '1m', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
  spike: {
    stages: [
      { duration: '20s', target: 1 },
      { duration: '10s', target: 100 },
      { duration: '40s', target: 100 },
      { duration: '10s', target: 1 },
      { duration: '20s', target: 0 },
    ],
  },
  soak: {
    stages: [
      { duration: '1m', target: 25 },
      { duration: '10m', target: 25 },
      { duration: '30s', target: 0 },
    ],
  },
  // single virtual user: the only profile permitted against production
  smoke: {
    stages: [
      { duration: '10s', target: 1 },
      { duration: '30s', target: 1 },
      { duration: '5s', target: 0 },
    ],
  },
};

if (!SCENARIOS[PROFILE]) {
  throw new Error(`unknown PROFILE "${PROFILE}"; expected one of ${Object.keys(SCENARIOS).join(', ')}`);
}

const duration = SCENARIOS[PROFILE];
// A single request must never turn into a write, and a hosted run stays at 1 VU.
const p95Budget = targetsHosted ? 1200 : 350;

export const options = {
  scenarios: { catalog: Object.assign({ executor: 'ramping-vus', startVUs: 0, gracefulRampDown: '10s' }, duration) },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [`p(95)<${p95Budget}`],
    checks: ['rate>0.99'],
  },
  // read-only: no request bodies, no connection churn beyond keep-alive
  discardResponseBodies: false,
  noConnectionReuse: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
  const categories = http.get(`${TARGET}${QUERIES.categories}`, { headers: HEADERS, tags: { name: 'categories' } });
  check(categories, {
    'categories: 200': (r) => r.status === 200,
    'categories: non-empty list': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });

  const books = http.get(`${TARGET}${QUERIES.books}`, { headers: HEADERS, tags: { name: 'books' } });
  check(books, {
    'books: 200': (r) => r.status === 200,
    'books: returns rows': (r) => Array.isArray(r.json()) && r.json().length > 0,
    'books: price present': (r) => Array.isArray(r.json()) && r.json().every((b) => typeof b.price === 'number'),
  });

  const detail = http.get(`${TARGET}${QUERIES.bookDetail}`, { headers: HEADERS, tags: { name: 'bookDetail' } });
  check(detail, { 'bookDetail: 200': (r) => r.status === 200 });

  const wilayas = http.get(`${TARGET}${QUERIES.wilayas}`, { headers: HEADERS, tags: { name: 'wilayas' } });
  check(wilayas, {
    'wilayas: 200': (r) => r.status === 200,
    'wilayas: 58 rows': (r) => Array.isArray(r.json()) && r.json().length === 58,
  });
}

export function handleSummary(data) {
  const line = (label, value) => `${label.padEnd(26)} ${value}\n`;
  let out = `\n=== k6 ${PROFILE} against ${TARGET} ===\n`;
  const metrics = data.metrics;
  out += line('requests', metrics.http_reqs ? metrics.http_reqs.values.count : 'n/a');
  out += line('req/s (avg)', metrics.http_reqs ? metrics.http_reqs.values.rate.toFixed(1) : 'n/a');
  out += line('failed rate', metrics.http_req_failed ? (metrics.http_req_failed.values.rate * 100).toFixed(2) + '%' : 'n/a');
  const d = metrics.http_req_duration ? metrics.http_req_duration.values : null;
  if (d) {
    out += line('duration avg', d.avg.toFixed(1) + ' ms');
    out += line('duration med', d.med.toFixed(1) + ' ms');
    out += line('duration p95', d['p(95)'].toFixed(1) + ' ms');
    out += line('duration p99', d['p(99)'].toFixed(1) + ' ms');
    out += line('duration max', d.max.toFixed(1) + ' ms');
  }
  for (const [name, metric] of Object.entries(metrics)) {
    if (name.startsWith('http_req_duration{')) {
      out += line(name.replace('http_req_duration{', '').replace('}', ''), `p95 ${metric.values['p(95)'].toFixed(1)} ms`);
    }
  }
  out += line('checks passed', metrics.checks ? (metrics.checks.values.rate * 100).toFixed(2) + '%' : 'n/a');
  return { stdout: out };
}

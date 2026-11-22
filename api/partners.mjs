const reply = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const allowedOrigins = ['https://bounty-box.com', 'https://www.bounty-box.com'];
const fieldLimits = {
  company: 200, contactName: 200, email: 254, product: 200, website: 500, links: 2000, category: 100,
  description: 4000, inCatalog: 40, standardPricing: 2000, partnerPricing: 2000, freeTier: 500, notes: 4000,
};
const requiredFields = ['company', 'email', 'product', 'category', 'description', 'standardPricing', 'partnerPricing'];
const createTableQuery = `CREATE TABLE IF NOT EXISTS public.bountybox_partners (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  company text NOT NULL,
  product text NOT NULL,
  application jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
const insertQuery = 'INSERT INTO public.bountybox_partners (email, company, product, application) VALUES ($1, $2, $3, $4::jsonb)';

async function runQuery(connection, query, params = []) {
  const host = new URL(connection).hostname.replace(/^[^.]+\./, 'api.');
  const response = await fetch(`https://${host}/sql`, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connection },
    body: JSON.stringify({ query, params }),
  });
  if (!response.ok) throw new Error('Storage unavailable');
}

let tableReady;

export default {
  async fetch(request) {
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: 'Invalid origin.' });
    if (!request.headers.get('content-type')?.includes('application/json')) return reply(415, { error: 'Expected JSON.' });
    let body;
    try {
      const text = await request.text();
      if (text.length > 24000) return reply(413, { error: 'Application too large.' });
      body = JSON.parse(text);
    } catch { return reply(400, { error: 'Invalid request.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request.' });
    const application = {};
    for (const [field, limit] of Object.entries(fieldLimits)) {
      const value = typeof body[field] === 'string' ? body[field].trim() : '';
      if (value.length > limit) return reply(400, { error: `The ${field} field is too long.` });
      application[field] = value;
    }
    application.email = application.email.toLowerCase();
    const missingField = requiredFields.find((field) => !application[field]);
    if (missingField) return reply(400, { error: 'Fill in every required field.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return reply(400, { error: 'Enter a valid work email.' });
    const connection = process.env.WAITLIST_DATABASE_URL;
    if (!connection) return reply(503, { error: 'Applications are temporarily unavailable. Please try again shortly.' });
    try {
      tableReady ??= runQuery(connection, createTableQuery).catch((error) => { tableReady = undefined; throw error; });
      await tableReady;
      await runQuery(connection, insertQuery, [application.email, application.company, application.product, JSON.stringify(application)]);
      return reply(200, { ok: true });
    } catch { return reply(503, { error: 'Could not save your application. Please try again shortly.' }); }
  },
};

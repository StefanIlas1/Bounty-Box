const reply = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export default {
  async fetch(request) {
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    if (request.headers.get('origin') && !['https://bounty-box.com', 'https://www.bounty-box.com'].includes(request.headers.get('origin'))) return reply(403, { error: 'Invalid origin.' });
    if (!request.headers.get('content-type')?.includes('application/json')) return reply(415, { error: 'Expected JSON.' });
    let body;
    try {
      const text = await request.text();
      if (text.length > 2048) return reply(413, { error: 'Request too large.' });
      body = JSON.parse(text);
    } catch { return reply(400, { error: 'Invalid request.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request.' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Enter a valid email address.' });
    if (body.website) return reply(200, { ok: true });
    const connection = process.env.WAITLIST_DATABASE_URL;
    if (!connection) return reply(503, { error: 'Signups are temporarily unavailable. Please try again shortly.' });
    try {
      const host = new URL(connection).hostname.replace(/^[^.]+\./, 'api.');
      const response = await fetch(`https://${host}/sql`, {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connection },
        body: JSON.stringify({ query: 'INSERT INTO public.bountybox_waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', params: [email] }),
      });
      if (!response.ok) throw new Error('Storage unavailable');
      return reply(200, { ok: true });
    } catch { return reply(503, { error: 'Could not save your email. Please try again shortly.' }); }
  },
};

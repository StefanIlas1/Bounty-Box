import { getDeployment } from '../src/lib/hosted/store';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export default { async fetch(request: Request): Promise<Response> {
  const headers: Record<string,string> = {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };
  const error = (status:number, message:string) => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bounty-Box</title><body><h1>${escape(message)}</h1><p><a href="/">Back to Bounty-Box</a></p></body></html>`, {status,headers});
  if (!['GET','HEAD'].includes(request.method)) return error(405,'This page supports viewing only.');
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? url.pathname.replace(/^\/product-v1\//,'');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>100) return error(404,'Application not found.');
  try {
    const deployment = await getDeployment(slug);
    if (!deployment) return error(404,'This application is not available or its judging session has ended.');
    const upstream = new URL(deployment.url);
    if(upstream.protocol!=='https:' || upstream.username || upstream.password || upstream.port || upstream.pathname!=='/' || upstream.search || upstream.hash ||
      !/^[a-z0-9-]+\.app\.sb\.createos\.sh$/.test(upstream.hostname)) return error(503,'Application address is unavailable.');
    headers['Content-Security-Policy'] += `; frame-src ${upstream.origin}`;
    const title=escape(deployment.title.slice(0,160));
    // Keep the generated code on its separate CreateOS origin. It never receives
    // Bounty-Box session cookies, provider keys or access to the parent document.
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Bounty-Box</title><style>*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:system-ui,sans-serif;background:#090f1c;color:#edf2ff}body{display:flex;flex-direction:column}header{height:48px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;border-bottom:1px solid #243047;font-size:13px}header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}a{color:#f4c44d;text-decoration:none;white-space:nowrap}iframe{border:0;display:block;width:100%;flex:1;min-height:0;background:white}</style></head><body><header><strong>${title}</strong><a href="/">← Back to site</a></header><iframe src="${escape(upstream.href)}" title="${title}" sandbox="allow-scripts allow-forms allow-same-origin" referrerpolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"></iframe></body></html>`;
    return new Response(request.method==='HEAD'?null:html,{status:200,headers});
  } catch { return error(503,'The application is temporarily unavailable. Please try again.'); }
} };

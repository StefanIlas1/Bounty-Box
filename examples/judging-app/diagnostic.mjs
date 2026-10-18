// Configuration checks only; no connectivity or performance measurements.
let configurationValid = false;
try {
  const db = new URL(process.env.NEON_DATABASE_URL);
  const origin = new URL(process.env.BOUNTYBOX_PUBLIC_ORIGIN);
  configurationValid = ['postgres:', 'postgresql:'].includes(db.protocol) && db.hostname.endsWith('.neon.tech') && /^[a-zA-Z0-9_]{1,48}$/.test(process.env.BOUNTYBOX_TRIAL_NAMESPACE || '') && Boolean(process.env.BOUNTYBOX_INGRESS_TOKEN) && origin.protocol === 'https:' && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash;
} catch {}
console.log(JSON.stringify({configurationValid, databaseConnectivityTested: false, benchmarkPerformed: false}));
process.exitCode = configurationValid ? 0 : 1;

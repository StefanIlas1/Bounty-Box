// Fallback catalog: 10 options per infrastructure layer with monthly list prices.
// Used when Stripe Projects or the CreateOS sandbox is unavailable (or out of quota),
// so a run can still be simulated end to end. Prices are public list prices or
// Stripe Projects catalog prices as of Oct 2026, rounded; `source` says which.
// capacityUsers / baseP95Ms are rough planning figures for the simulator only.
import type { Service } from './types'

export type Layer = 'database' | 'cache' | 'hosting' | 'auth' | 'email' | 'storage' | 'queue' | 'search' | 'observability' | 'ai'

export interface CatalogOption {
  layer: Layer
  provider: string
  tier: string
  serviceId: string        // Stripe Projects service id where one exists, else "provider/tier"
  monthlyUsd: number
  capacityUsers: number    // concurrent users this tier comfortably serves (planning figure)
  baseP95Ms: number        // p95 at light load (planning figure)
  source: 'stripe-projects-catalog' | 'public-pricing'
}

const o = (layer: Layer, provider: string, tier: string, serviceId: string, monthlyUsd: number, capacityUsers: number, baseP95Ms: number, source: CatalogOption['source'] = 'public-pricing'): CatalogOption =>
  ({ layer, provider, tier, serviceId, monthlyUsd, capacityUsers, baseP95Ms, source })

const SP = 'stripe-projects-catalog' as const

export const FALLBACK_CATALOG: Record<Layer, CatalogOption[]> = {
  database: [
    o('database', 'Neon', 'free', 'neon/free', 0, 400, 38, SP),
    o('database', 'Supabase', 'free', 'supabase/free', 0, 350, 42, SP),
    o('database', 'Prisma Postgres', 'free', 'prisma/free', 0, 300, 45, SP),
    o('database', 'Turso', 'starter', 'turso/starter', 0, 500, 30),
    o('database', 'Neon', 'launch', 'neon/launch', 19, 2500, 24, SP),
    o('database', 'Supabase', 'pro', 'supabase/pro', 25, 3000, 26, SP),
    o('database', 'Railway Postgres', 'usage', 'railway/postgres', 10, 1500, 32, SP),
    o('database', 'Render Postgres', 'basic-256mb', 'render/postgres', 6, 800, 40, SP),
    o('database', 'Fly.io Managed Postgres', 'basic', 'flyio/mpg', 38, 4000, 22, SP),
    o('database', 'ClickHouse Cloud', 'basic', 'clickhouse/basic', 66, 6000, 18, SP),
  ],
  cache: [
    o('cache', 'Upstash Redis', 'free', 'upstash/redis', 0, 600, 6, SP),
    o('cache', 'Upstash Redis', 'pay-as-you-go', 'upstash/redis', 10, 5000, 4, SP),
    o('cache', 'Railway Redis', 'usage', 'railway/redis', 5, 2000, 5, SP),
    o('cache', 'Cloudflare KV', 'workers-paid', 'cloudflare/kv', 5, 8000, 8, SP),
    o('cache', 'Laravel Cloud Valkey', 'starter', 'laravel_cloud/valkey', 7, 2500, 5, SP),
    o('cache', 'Redis Cloud', 'essentials-250mb', 'redis/essentials', 5, 1500, 5),
    o('cache', 'Momento', 'free', 'momento/free', 0, 800, 7),
    o('cache', 'Aiven Valkey', 'hobbyist', 'aiven/valkey', 5, 1200, 6),
    o('cache', 'Render Key Value', 'starter', 'render/key-value', 10, 2000, 5),
    o('cache', 'Dragonfly Cloud', 'starter', 'dragonfly/starter', 15, 6000, 3),
  ],
  hosting: [
    o('hosting', 'CreateOS', 'free', 'createos/free', 0, 300, 60, SP),
    o('hosting', 'CreateOS', 'beginner', 'createos/beginner-monthly', 10, 1500, 35, SP),
    o('hosting', 'CreateOS', 'pro', 'createos/pro-monthly', 75, 12000, 20, SP),
    o('hosting', 'Vercel', 'hobby', 'vercel/hobby', 0, 500, 45, SP),
    o('hosting', 'Vercel', 'pro', 'vercel/pro', 20, 5000, 25, SP),
    o('hosting', 'Railway', 'hobby', 'railway/hobby', 5, 1000, 40, SP),
    o('hosting', 'Railway', 'pro', 'railway/pro', 20, 6000, 28, SP),
    o('hosting', 'Render', 'starter web service', 'render/web-service', 7, 900, 48, SP),
    o('hosting', 'Fly.io', 'shared-cpu-1x', 'flyio/app', 4, 700, 42, SP),
    o('hosting', 'Render', 'static site', 'render/static-site', 0, 20000, 15, SP),
  ],
  auth: [
    o('auth', 'Auth0', 'free', 'auth0/free', 0, 25000, 80, SP),
    o('auth', 'Auth0', 'b2c-essentials', 'auth0/b2c-essentials', 35, 50000, 70, SP),
    o('auth', 'Privy', 'free', 'privy/free', 0, 10000, 90, SP),
    o('auth', 'Supabase Auth', 'free (50K MAU)', 'supabase/free', 0, 50000, 60, SP),
    o('auth', 'Neon Auth', 'included', 'neon/postgres', 0, 10000, 65, SP),
    o('auth', 'Clerk', 'free (10K MAU)', 'clerk/free', 0, 10000, 55),
    o('auth', 'Clerk', 'pro', 'clerk/pro', 25, 100000, 50),
    o('auth', 'Stytch', 'free', 'stytch/free', 0, 5000, 70),
    o('auth', 'WorkOS AuthKit', 'free (1M MAU)', 'workos/authkit', 0, 1000000, 60),
    o('auth', 'Firebase Auth', 'spark', 'firebase/spark', 0, 50000, 75),
  ],
  email: [
    o('email', 'Resend', 'free (3K/mo)', 'resend/free', 0, 3000, 300, SP),
    o('email', 'Resend', 'pro (50K/mo)', 'resend/pro', 20, 50000, 250, SP),
    o('email', 'AgentMail', 'free', 'agentmail/free', 0, 3000, 350, SP),
    o('email', 'AgentMail', 'developer', 'agentmail/developer', 20, 30000, 300, SP),
    o('email', 'Customer.io', 'sandbox', 'customerio/builder:sandbox', 0, 1000, 400, SP),
    o('email', 'Postmark', 'basic (10K/mo)', 'postmark/basic', 15, 10000, 200),
    o('email', 'SendGrid', 'essentials', 'sendgrid/essentials', 20, 50000, 300),
    o('email', 'Mailgun', 'basic', 'mailgun/basic', 15, 10000, 280),
    o('email', 'Amazon SES', 'pay-as-you-go', 'aws/ses', 1, 100000, 350),
    o('email', 'Loops', 'free', 'loops/free', 0, 4000, 320),
  ],
  storage: [
    o('storage', 'Cloudflare R2', '10 GB free', 'cloudflare/r2:bucket', 0, 50000, 60, SP),
    o('storage', 'Supabase Storage', 'free (1 GB)', 'supabase/free', 0, 5000, 80, SP),
    o('storage', 'Railway Bucket', 'usage', 'railway/bucket', 2, 10000, 70, SP),
    o('storage', 'Cloudinary', 'free', 'cloudinary/free', 0, 5000, 90, SP),
    o('storage', 'Backblaze B2', '10 GB free', 'backblaze/b2', 0, 20000, 90),
    o('storage', 'AWS S3', 'standard', 'aws/s3', 3, 100000, 70),
    o('storage', 'Tigris', 'free', 'tigris/free', 0, 20000, 60),
    o('storage', 'UploadThing', 'free (2 GB)', 'uploadthing/free', 0, 3000, 100),
    o('storage', 'Vercel Blob', 'hobby', 'vercel/blob', 0, 5000, 70),
    o('storage', 'Wasabi', 'pay-as-you-go', 'wasabi/standard', 7, 50000, 100),
  ],
  queue: [
    o('queue', 'Inngest', 'hobby', 'inngest/hobby', 0, 2000, 40, SP),
    o('queue', 'Inngest', 'pro', 'inngest/pro', 99, 50000, 30, SP),
    o('queue', 'Upstash QStash', 'free (500/day)', 'upstash/qstash', 0, 500, 50, SP),
    o('queue', 'Cloudflare Queues', 'workers-paid', 'cloudflare/queues', 5, 20000, 35, SP),
    o('queue', 'Trigger.dev', 'free', 'trigger/free', 0, 1000, 45),
    o('queue', 'AWS SQS', 'pay-as-you-go', 'aws/sqs', 1, 100000, 30),
    o('queue', 'Hookdeck', 'free', 'hookdeck/free', 0, 1000, 60),
    o('queue', 'Railway Redis queue', 'usage', 'railway/redis', 5, 3000, 20, SP),
    o('queue', 'Google Pub/Sub', 'pay-as-you-go', 'gcp/pubsub', 1, 100000, 40),
    o('queue', 'Defer', 'hobby', 'defer/hobby', 0, 1000, 50),
  ],
  search: [
    o('search', 'Algolia', 'free (build)', 'algolia/application', 0, 10000, 20, SP),
    o('search', 'Upstash Search', 'free (10K docs)', 'upstash/search', 0, 3000, 25, SP),
    o('search', 'Exa', 'free', 'exa/free', 0, 1000, 400, SP),
    o('search', 'Typesense Cloud', 'small', 'typesense/small', 22, 20000, 15),
    o('search', 'Meilisearch Cloud', 'build', 'meilisearch/build', 30, 20000, 18),
    o('search', 'Postgres full-text', 'included', 'neon/free', 0, 1500, 35, SP),
    o('search', 'Elastic Cloud', 'standard', 'elastic/standard', 95, 100000, 20),
    o('search', 'Orama Cloud', 'free', 'orama/free', 0, 2000, 25),
    o('search', 'Supabase pgvector', 'free', 'supabase/free', 0, 1500, 40, SP),
    o('search', 'Parallel Search API', 'pay-as-you-go', 'parallel/api', 5, 5000, 500, SP),
  ],
  observability: [
    o('observability', 'PostHog', 'free', 'posthog/free', 0, 100000, 0, SP),
    o('observability', 'Datadog', 'trial', 'datadog/trial', 0, 100000, 0, SP),
    o('observability', 'Pydantic Logfire', 'personal', 'pydantic/personal', 0, 50000, 0, SP),
    o('observability', 'Sentry', 'developer', 'sentry/developer', 0, 50000, 0),
    o('observability', 'Better Stack', 'free', 'betterstack/free', 0, 50000, 0),
    o('observability', 'Axiom', 'personal', 'axiom/personal', 0, 50000, 0),
    o('observability', 'Grafana Cloud', 'free', 'grafana/free', 0, 50000, 0),
    o('observability', 'Highlight', 'free', 'highlight/free', 0, 20000, 0),
    o('observability', 'Honeycomb', 'free', 'honeycomb/free', 0, 50000, 0),
    o('observability', 'New Relic', 'free', 'newrelic/free', 0, 50000, 0),
  ],
  ai: [
    o('ai', 'OpenRouter', 'free models', 'openrouter/free', 0, 200, 900, SP),
    o('ai', 'OpenRouter', 'pay-as-you-go', 'openrouter/pay_as_you_go', 10, 5000, 700, SP),
    o('ai', 'Perplexity API', '$10 credits', 'perplexity/api', 0, 1000, 1200, SP),
    o('ai', 'Composio', 'hobby', 'composio/hobby', 0, 1000, 500, SP),
    o('ai', 'Anthropic API', 'pay-as-you-go', 'anthropic/api', 15, 10000, 800),
    o('ai', 'Groq', 'free', 'groq/free', 0, 500, 300),
    o('ai', 'Together AI', 'pay-as-you-go', 'together/api', 5, 5000, 600),
    o('ai', 'Fireworks AI', 'pay-as-you-go', 'fireworks/api', 5, 5000, 500),
    o('ai', 'Replicate', 'pay-as-you-go', 'replicate/api', 5, 2000, 1500),
    o('ai', 'Mistral API', 'free tier', 'mistral/free', 0, 500, 700),
  ],
}

export const LAYER_TO_SERVICE_CATEGORY: Record<Layer, Service['category']> = {
  database: 'database', cache: 'cache', hosting: 'hosting', auth: 'auth', email: 'email',
  storage: 'storage', queue: 'queue', search: 'search', observability: 'other', ai: 'other',
}

export const toService = (opt: CatalogOption): Service => ({
  category: LAYER_TO_SERVICE_CATEGORY[opt.layer],
  provider: opt.provider,
  serviceId: opt.serviceId,
  monthlyCost: opt.monthlyUsd,
  tier: opt.tier,
})

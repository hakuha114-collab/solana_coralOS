/**
 * ProofSentry market launcher: one buyer and three competing API-verification sellers.
 * Each round completes WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> RELEASED on devnet.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

function loadEnv(): Record<string, string> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const env: Record<string, string> = { ...(process.env as Record<string, string>) }
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // Environment-only operation is supported.
  }
  return env
}

const str = (value: string) => ({ type: 'string', value })
const f64 = (value: number) => ({ type: 'f64', value })
const agent = (name: string, options: Record<string, unknown>) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name,
  provider: { type: 'local', runtime: 'docker' },
  options,
})

async function main(): Promise<void> {
  const env = loadEnv()
  const wallet = env.WALLET
  const keypair = env.BUYER_KEYPAIR_B58
  if (!wallet || !keypair) {
    throw new Error('WALLET and BUYER_KEYPAIR_B58 are required; run `node scripts/setup.js`')
  }
  const rpc = env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
  const llmOptions: Record<string, unknown> = {}
  if (env.VENICE_API_KEY) llmOptions.VENICE_API_KEY = str(env.VENICE_API_KEY)
  if (env.OPENAI_API_KEY) llmOptions.OPENAI_API_KEY = str(env.OPENAI_API_KEY)
  if (env.ANTHROPIC_API_KEY) llmOptions.ANTHROPIC_API_KEY = str(env.ANTHROPIC_API_KEY)
  if (env.LLM_PROVIDER) llmOptions.LLM_PROVIDER = str(env.LLM_PROVIDER)
  if (env.LLM_MODEL) llmOptions.LLM_MODEL = str(env.LLM_MODEL)
  if (env.TRACE) llmOptions.TRACE = str(env.TRACE)

  const profiles = {
    'seller-fast': {
      floor: 0.00018,
      depth: 'smoke',
      persona: 'a fast API smoke tester optimised for low price and clear availability evidence',
    },
    'seller-guardian': {
      floor: 0.00032,
      depth: 'standard',
      persona: 'an API reliability engineer balancing price, safety, and reproducible evidence',
    },
    'seller-forensic': {
      floor: 0.00055,
      depth: 'deep',
      persona: 'a security-focused verifier adding transport and security-header checks',
    },
  } as const
  const sellers = Object.keys(profiles) as Array<keyof typeof profiles>
  const seller = (name: keyof typeof profiles) => {
    const profile = profiles[name]
    return agent(name, {
      SELLER_WALLET: str(wallet),
      SOLANA_RPC_URL: str(rpc),
      AGENT_NAME: str(name),
      SERVICES: str('proofsentry'),
      SERVICE: str('proofsentry'),
      FLOOR_SOL: f64(profile.floor),
      PERSONA: str(profile.persona),
      AUDIT_DEPTH: str(profile.depth),
      ...llmOptions,
    })
  }

  const buyerOptions: Record<string, unknown> = {
    BUYER_KEYPAIR_B58: str(keypair),
    AGENT_NAME: str('buyer-agent'),
    SOLANA_RPC_URL: str(rpc),
    SELLER_WALLET: str(wallet),
    BUYER_MAX_SOL: f64(Number(env.BUYER_MAX_SOL ?? '0.001')),
    BUYER_SERVICE: str(env.BUYER_SERVICE ?? 'proofsentry'),
    BUYER_ARG: str(env.BUYER_ARG ?? 'https://api.github.com 200'),
    MARKET_SELLERS: str(sellers.join(',')),
    SETTLEMENT_MODE: str(env.SETTLEMENT_MODE ?? 'arbiter'),
    ...llmOptions,
  }
  if (env.BUYER_ARGS) buyerOptions.BUYER_ARGS = str(env.BUYER_ARGS)
  if (env.ARBITER_KEYPAIR_B58) buyerOptions.ARBITER_KEYPAIR_B58 = str(env.ARBITER_KEYPAIR_B58)

  const response = await fetch(`${BASE}/api/v1/local/session`, {
    method: 'POST',
    headers: AUTH,
    body: JSON.stringify({
      agentGraphRequest: {
        agents: [
          agent('buyer-agent', buyerOptions),
          seller('seller-fast'),
          seller('seller-guardian'),
          seller('seller-forensic'),
        ],
      },
      namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: 'default' } },
      execution: { mode: 'immediate' },
    }),
  })
  if (!response.ok) throw new Error(`session create failed: ${response.status} ${await response.text()}`)
  const { sessionId } = await response.json() as { sessionId: string }

  console.log(`ProofSentry session: ${sessionId}`)
  console.log(`Buyer target: ${env.BUYER_ARG ?? 'https://api.github.com 200'}`)
  console.log(`Sellers: ${sellers.join(', ')}`)
  console.log('Watch: docker logs -f buyer-agent')
}

main().catch((error) => {
  console.error(`[proofsentry-market] ${error}`)
  process.exitCode = 1
})

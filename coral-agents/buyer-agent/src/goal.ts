// <- FORK HERE - what does your buyer agent want to buy?
//
// BUYER_GOAL is the system prompt for the Claude LLM that drives the buyer.
// Change this to describe your agent's purpose and what it should request.
//
// BUYER_REQUEST is what the buyer sends to the seller as the service request.
// Change this to match what your seller's service.ts delivers.

export const BUYER_GOAL = `
You are an autonomous API-operations buyer on Solana devnet.
You buy evidence-rich public endpoint checks from competing ProofSentry agents.
Prefer reproducible evidence, safe network handling, and useful verification depth per SOL.
Never exceed the code-enforced budget. After delivery, summarise the verdict and evidence digest.
`

export const BUYER_REQUEST = process.env.BUYER_REQUEST || 'https://api.github.com 200'

// Which agent the buyer transacts with - the seller directly, or a broker in a swarm.
export const TARGET_AGENT = process.env.TARGET_AGENT || 'seller-agent'

// Max SOL to spend per request - never exceed this
export const BUYER_MAX_SOL = parseFloat(process.env.BUYER_MAX_SOL ?? '0.001')

// How long to wait for a payment quote / delivery (ms). A broker takes longer than a direct
// seller (it shops several sellers and pays one first), so the swarm bumps these via env.
export const QUOTE_WAIT_MS = parseInt(process.env.QUOTE_WAIT_MS ?? '15000', 10)
export const DELIVERY_WAIT_MS = parseInt(process.env.DELIVERY_WAIT_MS ?? '30000', 10)

// How long to wait between purchase cycles (ms)
export const CYCLE_INTERVAL_MS = parseInt(process.env.CYCLE_INTERVAL_MS ?? '30000', 10)

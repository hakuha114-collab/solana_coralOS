import type { Feed, Round, RoundBid } from './types'

export const PROOFSENTRY_DEMO_SESSION = 'proofsentry-demo'
export const PROOFSENTRY_DEMO_DIGEST =
  'sha256:1b369d96c2af7a32761748470e0d3b62b8ac456ee46f1d9cc7397c5015cca2c6'

const allBids: RoundBid[] = [
  { by: 'seller-fast', priceSol: 0.00018, note: 'fast availability proof' },
  { by: 'seller-guardian', priceSol: 0.00032, note: 'balanced evidence' },
  { by: 'seller-forensic', priceSol: 0.00055, note: 'deep security checks' },
]

/** Deterministic feed used by the public walkthrough. It never moves funds. */
export function createProofSentryDemoFeed(elapsedMs: number): Feed {
  const bids =
    elapsedMs < 3_000 ? [] : elapsedMs < 6_000 ? allBids.slice(0, 1) : allBids
  const award =
    elapsedMs >= 9_000
      ? { to: 'seller-guardian', reason: 'best balance of evidence depth and price' }
      : undefined
  const delivered =
    elapsedMs >= 14_000
      ? {
          raw: 'ProofSentry evidence delivered',
          data: {
            service: 'proofsentry',
            version: '1.0',
            depth: 'standard',
            observedAt: '2026-07-04T17:45:00.000Z',
            latencyMs: 184,
            verdict: 'pass',
            summary: '4/4 checks passed',
            evidenceDigest: PROOFSENTRY_DEMO_DIGEST,
            evidence: {
              target: 'https://api.github.com/',
              observedStatus: 200,
              checks: [
                { name: 'status', pass: true, detail: 'received 200; expected 200' },
                {
                  name: 'https',
                  pass: true,
                  detail: 'request and redirects stayed on HTTPS',
                },
                {
                  name: 'content-type',
                  pass: true,
                  detail: 'application/json; charset=utf-8',
                },
                {
                  name: 'latency',
                  pass: true,
                  detail: '184ms within 8000ms budget',
                },
              ],
            },
          },
        }
      : undefined

  const round: Round = {
    round: 1,
    want: {
      service: 'proofsentry',
      arg: 'https://api.github.com 200',
      budgetSol: 0.001,
    },
    bids,
    declined: [],
    award,
    delivered,
    status: delivered ? 'delivered' : award ? 'awarded' : 'bidding',
  }

  return {
    session: PROOFSENTRY_DEMO_SESSION,
    updatedAt: '2026-07-04T17:45:00.000Z',
    rounds: [round],
  }
}

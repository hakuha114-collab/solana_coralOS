import { describe, expect, it } from 'vitest'
import {
  createProofSentryDemoFeed,
  PROOFSENTRY_DEMO_DIGEST,
  PROOFSENTRY_DEMO_SESSION,
} from './demoFeed'

describe('createProofSentryDemoFeed', () => {
  it('progresses through bidding, award, and delivery deterministically', () => {
    const bidding = createProofSentryDemoFeed(0).rounds[0]
    const competitive = createProofSentryDemoFeed(6_000).rounds[0]
    const awarded = createProofSentryDemoFeed(9_000).rounds[0]
    const delivered = createProofSentryDemoFeed(14_000).rounds[0]

    expect(bidding.status).toBe('bidding')
    expect(bidding.bids).toHaveLength(0)
    expect(competitive.bids).toHaveLength(3)
    expect(awarded.award?.to).toBe('seller-guardian')
    expect(delivered.status).toBe('delivered')
    expect(
      (delivered.delivered?.data as { evidenceDigest: string }).evidenceDigest,
    ).toBe(PROOFSENTRY_DEMO_DIGEST)
  })

  it('uses a stable public demo session', () => {
    expect(createProofSentryDemoFeed(20_000).session).toBe(PROOFSENTRY_DEMO_SESSION)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverService } from './service.js'
import { runProofSentry } from './proofsentry.js'
import type { lookup as dnsLookup } from 'node:dns/promises'

describe('deliverService txline-only routing', () => {
  const realFetch = global.fetch

  beforeEach(() => {
    process.env.TXLINE_API_KEY = 'token'
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.VENICE_API_KEY
    delete process.env.LLM_PROVIDER
  })

  afterEach(() => {
    global.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('rejects legacy generic services', async () => {
    const out = JSON.parse(await deliverService('coingecko eth'))
    expect(out).toEqual({
      error: 'unsupported service',
      service: 'coingecko',
      supported: ['proofsentry', 'txline'],
    })
  })

  it('returns fixtures from TxLINE', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
      return { ok: true, json: async () => ([{ FixtureId: 1 }, { FixtureId: 2 }]) }
    }) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('txline fixtures'))
    expect(out).toMatchObject({ service: 'txline-fixtures', count: 2 })
  })

  it('produces a deterministic edge when no live LLM key is configured', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
      if (url.includes('/api/odds/snapshot/123')) {
        return {
          ok: true,
          json: async () => ([{
            SuperOddsType: '1X2',
            PriceNames: ['part1', 'x', 'part2'],
            Pct: ['62', '22', '16'],
          }]),
        }
      }
      return {
        ok: true,
        json: async () => ([{
          FixtureId: 123,
          Participant1: 'A',
          Participant2: 'B',
          Competition: 'World Cup',
        }]),
      }
    }) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('txline edge 123'))
    expect(out.analysis.call).toContain('A')
    expect(out.analysis.note).toContain('deterministic fallback')
  })
})

describe('ProofSentry endpoint evidence', () => {
  const publicLookup = (async () => [{ address: '93.184.216.34', family: 4 }]) as unknown as typeof dnsLookup

  it('returns deterministic evidence for the same observation', async () => {
    const auditFetch = vi.fn(async () => new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
    const deps = { fetch: auditFetch, lookup: publicLookup, now: () => 1_000 }

    const first = JSON.parse(await runProofSentry('https://example.com/health 200', deps))
    const second = JSON.parse(await runProofSentry('https://example.com/health 200', deps))

    expect(first).toMatchObject({
      service: 'proofsentry',
      verdict: 'pass',
      summary: '4/4 checks passed',
      evidence: {
        observedStatus: 200,
        bodyBytes: 11,
      },
    })
    expect(first.evidenceDigest).toBe(second.evidenceDigest)
  })

  it.each([
    'http://example.com',
    'https://localhost/health',
    'https://127.0.0.1/health',
    'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.1/private',
    'https://198.51.100.7/documentation',
    'https://[::1]/health',
    'https://[2001:db8::1]/documentation',
  ])('rejects unsafe target %s', async (target) => {
    const out = JSON.parse(await runProofSentry(target, {
      fetch: vi.fn() as unknown as typeof fetch,
      lookup: publicLookup,
    }))
    expect(out.verdict).toBe('error')
  })

  it('rejects a public hostname that resolves to a private address', async () => {
    const privateLookup = (async () => [{ address: '192.168.1.10', family: 4 }]) as unknown as typeof dnsLookup
    const out = JSON.parse(await runProofSentry('https://example.com/health', {
      fetch: vi.fn() as unknown as typeof fetch,
      lookup: privateLookup,
    }))
    expect(out).toMatchObject({ verdict: 'error', error: 'target resolved to a private or reserved network' })
  })

  it('fails a response that exceeds the evidence cap', async () => {
    const out = JSON.parse(await runProofSentry('https://example.com/health', {
      fetch: vi.fn(async () => new Response('x'.repeat(70_000), { status: 200 })) as unknown as typeof fetch,
      lookup: publicLookup,
    }))
    expect(out).toMatchObject({ verdict: 'error', error: 'response exceeded 65536 bytes' })
  })
})

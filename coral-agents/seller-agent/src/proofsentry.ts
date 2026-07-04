import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_BYTES = 64 * 1024
const DEFAULT_MAX_REDIRECTS = 2

export interface ProofSentryDeps {
  fetch?: typeof fetch
  lookup?: typeof dnsLookup
  now?: () => number
}

interface ParsedRequest {
  target: URL
  expectedStatus: number
}

interface Check {
  name: string
  pass: boolean
  detail: string
}

function parseRequest(request: string): ParsedRequest {
  const [rawUrl, rawStatus] = request.trim().split(/\s+/)
  if (!rawUrl) throw new Error('target URL is required')

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    throw new Error('target must be an absolute URL')
  }
  if (target.protocol !== 'https:') throw new Error('only HTTPS targets are allowed')
  if (target.username || target.password) throw new Error('credentials in target URLs are not allowed')
  if (target.port && target.port !== '443') throw new Error('only the standard HTTPS port is allowed')

  const expectedStatus = rawStatus === undefined ? 200 : Number(rawStatus)
  if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
    throw new Error('expected status must be an integer from 100 to 599')
  }
  return { target, expectedStatus }
}

function isUnsafeIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    )
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase()
    if (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:') ||
      normalized.startsWith('2002:') ||
      normalized.startsWith('::ffff:')
    ) return true
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
    return mapped ? isUnsafeIp(mapped) : false
  }
  return true
}

async function assertPublicTarget(target: URL, lookup: typeof dnsLookup): Promise<void> {
  const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('local network targets are not allowed')
  }

  if (isIP(hostname)) {
    if (isUnsafeIp(hostname)) throw new Error('private or reserved network targets are not allowed')
    return
  }

  const records = await lookup(hostname, { all: true, verbatim: true })
  if (records.length === 0 || records.some((record) => isUnsafeIp(record.address))) {
    throw new Error('target resolved to a private or reserved network')
  }
}

async function readBodyLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`response exceeded ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function runProofSentry(request: string, deps: ProofSentryDeps = {}): Promise<string> {
  const fetchImpl = deps.fetch ?? fetch
  const lookup = deps.lookup ?? dnsLookup
  const now = deps.now ?? Date.now
  const timeoutMs = Number(process.env.PROOFSENTRY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
  const maxBytes = Number(process.env.PROOFSENTRY_MAX_BYTES ?? DEFAULT_MAX_BYTES)
  const depth = process.env.AUDIT_DEPTH ?? 'standard'

  try {
    const { target, expectedStatus } = parseRequest(request)
    let current = target
    let response: Response | undefined
    let redirects = 0
    const startedAt = now()

    while (redirects <= DEFAULT_MAX_REDIRECTS) {
      await assertPublicTarget(current, lookup)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        response = await fetchImpl(current, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            accept: 'application/json,text/plain;q=0.9,*/*;q=0.2',
            'user-agent': 'ProofSentry/1.0 (+https://github.com/hakuha114-collab/solana_coralOS)',
          },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      if (![301, 302, 303, 307, 308].includes(response.status)) break
      const location = response.headers.get('location')
      if (!location) throw new Error('redirect response did not include a location')
      redirects++
      if (redirects > DEFAULT_MAX_REDIRECTS) throw new Error('too many redirects')
      current = new URL(location, current)
      if (current.protocol !== 'https:') throw new Error('redirects must remain on HTTPS')
    }

    if (!response) throw new Error('target returned no response')
    const body = await readBodyLimited(response, maxBytes)
    const latencyMs = Math.max(0, now() - startedAt)
    const contentType = response.headers.get('content-type') ?? 'unknown'
    const checks: Check[] = [
      {
        name: 'status',
        pass: response.status === expectedStatus,
        detail: `received ${response.status}; expected ${expectedStatus}`,
      },
      {
        name: 'https',
        pass: current.protocol === 'https:',
        detail: 'request and redirects stayed on HTTPS',
      },
      {
        name: 'content-type',
        pass: contentType !== 'unknown',
        detail: contentType,
      },
      {
        name: 'latency',
        pass: latencyMs <= timeoutMs,
        detail: `${latencyMs}ms within ${timeoutMs}ms budget`,
      },
    ]
    if (depth === 'deep') {
      checks.push({
        name: 'security-headers',
        pass: response.headers.has('strict-transport-security') || response.headers.has('content-security-policy'),
        detail: 'HSTS or CSP present',
      })
    }

    const bodySha256 = sha256(body)
    const evidence = {
      target: target.toString(),
      finalUrl: current.toString(),
      expectedStatus,
      observedStatus: response.status,
      contentType,
      bodyBytes: body.byteLength,
      bodySha256,
      redirects,
      checks,
    }
    const evidenceDigest = sha256(JSON.stringify(evidence))
    const verdict = checks.every((check) => check.pass) ? 'pass' : 'fail'

    return JSON.stringify({
      service: 'proofsentry',
      version: '1.0',
      depth,
      observedAt: new Date().toISOString(),
      latencyMs,
      verdict,
      summary: `${checks.filter((check) => check.pass).length}/${checks.length} checks passed`,
      evidence,
      evidenceDigest: `sha256:${evidenceDigest}`,
    })
  } catch (error) {
    return JSON.stringify({
      service: 'proofsentry',
      version: '1.0',
      verdict: 'error',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

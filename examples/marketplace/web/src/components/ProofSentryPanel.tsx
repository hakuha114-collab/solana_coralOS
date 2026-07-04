interface Check {
  name: string
  pass: boolean
  detail: string
}

interface ProofSentryResult {
  verdict?: string
  summary?: string
  depth?: string
  latencyMs?: number
  evidenceDigest?: string
  evidence?: {
    target?: string
    observedStatus?: number
    checks?: Check[]
  }
}

export function ProofSentryPanel({ result }: { result: ProofSentryResult }) {
  const checks = result.evidence?.checks ?? []
  return (
    <section className={`proof-panel proof-${result.verdict ?? 'unknown'}`} data-testid="proofsentry-result">
      <header className="proof-head">
        <span>ProofSentry evidence</span>
        <strong>{(result.verdict ?? 'unknown').toUpperCase()}</strong>
      </header>
      <div className="proof-meta">
        <span>{result.depth ?? 'standard'} audit</span>
        <span>{result.latencyMs ?? '—'} ms</span>
        <span>HTTP {result.evidence?.observedStatus ?? '—'}</span>
      </div>
      <p className="proof-target">{result.evidence?.target}</p>
      <ul className="proof-checks">
        {checks.map((check) => (
          <li key={check.name} className={check.pass ? 'check-pass' : 'check-fail'}>
            <b>{check.pass ? 'PASS' : 'FAIL'}</b> {check.name}: {check.detail}
          </li>
        ))}
      </ul>
      <code className="proof-digest">{result.evidenceDigest}</code>
    </section>
  )
}

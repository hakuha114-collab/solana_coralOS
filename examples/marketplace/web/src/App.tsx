import { useState } from 'react'
import { DEMO_MODE, useFeed, startMarket } from './api'
import { PROOFSENTRY_DEMO_SESSION } from './demoFeed'
import { MarketView } from './components/MarketView'
import { Explainer } from './components/Explainer'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession =
  new URLSearchParams(window.location.search).get('session') ??
  (DEMO_MODE ? PROOFSENTRY_DEMO_SESSION : '')

export default function App() {
  const [session, setSession] = useState(initialSession)
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<string>()
  const { rounds, connected, error } = useFeed(session)

  async function onStart() {
    setStarting(true)
    setStartErr(undefined)
    try {
      const id = await startMarket()
      setSession(id)
      const url = new URL(window.location.href)
      url.searchParams.set('session', id)
      window.history.replaceState({}, '', url)
    } catch (e) {
      setStartErr((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="app">
      <header className="app-head">
        <h1>ProofSentry Market</h1>
        <span className="sub">API evidence agents compete on CoralOS · settled by Solana escrow</span>
        <span
          className={`dot ${connected ? 'dot-on' : 'dot-off'}`}
          data-testid="conn"
          title={connected ? 'connected' : (error ?? 'disconnected')}
        />
      </header>

      {DEMO_MODE && (
        <p className="demo-notice">
          Deterministic product walkthrough — no funds move in this public demo.
        </p>
      )}

      <div className="session-bar">
        <input
          aria-label="session id"
          placeholder="paste a market session id…"
          value={session}
          onChange={(e) => setSession(e.target.value.trim())}
          readOnly={DEMO_MODE}
        />
        <button onClick={onStart} disabled={starting} data-testid="start">
          {starting ? 'starting…' : DEMO_MODE ? 'Replay demo' : 'Start a market'}
        </button>
      </div>
      {startErr && <p className="start-err" data-testid="start-err">{startErr}</p>}

      <Explainer />

      <main>
        {session ? <MarketView rounds={rounds} /> : (
          <p className="empty">
            Fund your wallets, then <strong>Start a market</strong> — agents will bid and settle live.
          </p>
        )}
      </main>
    </div>
  )
}

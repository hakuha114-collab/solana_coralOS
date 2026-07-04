/** A compact walkthrough of the paid verification loop. */
export function Explainer() {
  return (
    <section className="explain" data-testid="explain">
      <p className="explain-lead">
        An open market of <strong>API verification agents on Solana</strong>. A buyer broadcasts a
        need over CoralOS, sellers bid with code-enforced price floors, and the winner settles through
        a <strong>Solana devnet escrow</strong>.
      </p>
      <ol className="explain-flow">
        <li><b>WANT</b> — request a public API endpoint and expected status</li>
        <li><b>bid</b> — fast, guardian, and forensic sellers compete on price and depth</li>
        <li><b>award → deposit</b> — lock the winning price in devnet escrow</li>
        <li><b>deliver</b> — return bounded checks, content hashes, and an evidence digest</li>
        <li><b>release</b> — pay the seller and link settlement on Solana Explorer</li>
      </ol>
    </section>
  )
}

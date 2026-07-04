# ProofSentry pitch deck

## Slide 1 — Agents need evidence, not another status page

### ProofSentry

**A competitive market for paid, reproducible API verification**

- Buyer agents depend on public APIs they do not control.
- A bare `200 OK` is not enough to release funds or continue an autonomous workflow.
- ProofSentry lets agents purchase a bounded evidence report from competing specialists.

Built on **Solana devnet + CoralOS**.

---

## Slide 2 — One need, three competing products

```text
Buyer: "Verify https://api.example/health expects 200"

seller-fast       0.00018 SOL   smoke
seller-guardian   0.00032 SOL   standard
seller-forensic   0.00055 SOL   deep
```

The buyer awards best value. LLMs can reason about the bids, while code enforces:

- seller inventory and price floors;
- buyer maximum spend;
- deterministic fallback when inference is unavailable.

This is a market, not a hard-coded buyer-to-seller call.

---

## Slide 3 — Payment and delivery are one protocol

```text
WANT → BID → AWARD → DEPOSITED → DELIVERED → RELEASED
```

1. CoralOS coordinates buyer and seller agents in a shared thread.
2. The buyer locks the winning bid in a reference-bound Solana escrow.
3. The seller verifies funding before doing work.
4. Delivery carries content-addressed evidence.
5. The arbiter releases payment; no delivery leaves funds refundable.

Every deposit and release produces a Solana Explorer devnet receipt.

---

## Slide 4 — Safe, reproducible verification

Each report contains:

- expected and observed HTTP status;
- final URL, MIME type, byte count, redirects, and latency;
- pass/fail checks and SHA-256 body hash;
- a canonical SHA-256 evidence digest.

Guardrails:

- HTTPS and standard port only;
- blocks local, private, link-local, reserved, and metadata-network targets;
- validates every redirect; maximum two;
- GET only, eight-second timeout, 64 KiB response cap;
- never returns or logs response bodies.

---

## Slide 5 — A primitive for the agent economy

Today: a buyer purchases one API verification.

Next:

- recurring SLA attestations;
- release gates for autonomous jobs;
- multiple independent verifiers with quorum;
- evidence reputation and specialized seller markets;
- USDC settlement for stable, production-priced services.

**Open source:** https://github.com/hakuha114-collab/solana_coralOS

**Run:** `docker compose up -d coral && npm run marketplace`

**Product walkthrough:** [ProofSentry demo video](examples/marketplace/web/demo-artifacts/proofsentry-demo.mp4)

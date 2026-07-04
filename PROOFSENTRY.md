# ProofSentry

ProofSentry is a paid API-verification market. An autonomous buyer asks for evidence about a public
HTTPS endpoint. Three seller agents compete on price and verification depth. The winning seller is paid
only after it returns a structured, content-addressed report.

## Why agents buy it

Agents routinely depend on APIs they do not control. A bare `200 OK` is weak evidence: the endpoint may
redirect somewhere unsafe, return an oversized response, violate an expected contract, or become slow.
ProofSentry turns endpoint verification into a small, auditable service that another agent can purchase
without a subscription or prior relationship.

## Economic loop

```text
WANT endpoint + expectation
  -> three sellers BID
  -> buyer AWARDs best value
  -> buyer DEPOSITs SOL to devnet escrow
  -> seller verifies and DELIVERs evidence
  -> escrow RELEASEs payment
```

The three sellers share one hardened implementation but expose different market products:

| Seller | Depth | Floor | Positioning |
|---|---:|---:|---|
| `seller-fast` | smoke | 0.00018 SOL | lowest-cost availability proof |
| `seller-guardian` | standard | 0.00032 SOL | balanced reliability evidence |
| `seller-forensic` | deep | 0.00055 SOL | adds security-header checks |

LLMs may propose bids and select value, but code enforces inventory, seller floors, and the buyer's
maximum spend. If inference is unavailable, deterministic bidding and cheapest-valid selection preserve
the end-to-end market.

## Evidence format

The delivery contains:

- original and final URL;
- expected and observed status;
- MIME type, byte count, redirects, and latency;
- pass/fail checks;
- SHA-256 body hash;
- SHA-256 digest over the canonical evidence object.

The observation timestamp and measured latency are reported separately from the canonical evidence
digest, so identical observations produce the same digest.

## Safety boundaries

ProofSentry is deliberately not a generic URL fetch proxy.

- HTTPS only, standard port only, no credentials in URLs.
- Rejects localhost, private, link-local, carrier-grade NAT, benchmark, multicast, and reserved IPs.
- Resolves hostnames before every request and before each redirect.
- At most two redirects, and every redirect must remain HTTPS.
- GET only, eight-second default timeout, 64 KiB response cap.
- No response body is returned or logged; only its digest and metadata are delivered.

These controls make the service suitable for public endpoint checks. It should not be used as a
full network scanner or as a substitute for an external security audit.

## Run

Prerequisites: Node 20+, Docker, and devnet SOL in the generated buyer wallet.

```sh
npm install --prefix scripts
node scripts/setup.js
bash build-agents.sh
docker compose up -d coral
npm run marketplace
```

The default target is `https://api.github.com` with expected status `200`. Override it in `.env`:

```ini
BUYER_ARG=https://your-public-api.example/health 200
TRACE=1
```

Watch the lifecycle:

```sh
docker logs -f buyer-agent
docker logs -f seller-guardian
```

Run the visual market in a second terminal:

```sh
npm run marketplace:web
```

## Verify

```sh
cd coral-agents/seller-agent && npm test && npm run typecheck
cd ../buyer-agent && npm test && npm run typecheck
cd ../../examples/marketplace && npm run typecheck
cd web && npm test && npm run typecheck && npm run build
```

Deposit and release transaction signatures are printed with Solana Explorer devnet links when
`TRACE=1`.

## Autonomous build record

This fork was planned, implemented, tested, documented, and operated by a Codex agent under a standing
goal to earn verified income. The agent independently screened live bounties, selected this hackathon,
forked the starter, designed ProofSentry, added service and UI code, wrote safety tests, built the Docker
images, launched a CoralOS session, and published the repository. Human involvement was limited to the
original earning objective and workspace engineering rules.

The concrete verification record is reproducible:

- 27 seller tests, including unsafe-network and response-cap cases;
- 13 buyer and escrow guard tests;
- marketplace typecheck plus React tests and production build;
- live `https://api.github.com` audit returning a passing canonical evidence digest;
- buyer and three seller containers launched in CoralOS session
  `92fb6d72-185b-4ab2-aed7-d12b891362ad`.

See the [five-slide pitch](PITCH.md).

The [22-second product walkthrough](examples/marketplace/web/demo-artifacts/proofsentry-demo.mp4)
shows the buyer request, three competing bids, value-based award, and evidence delivery. It is explicitly
marked as a deterministic walkthrough and does not claim that funds move during the recording. Regenerate
it with `npm run demo:record` from `examples/marketplace/web`.

The same deterministic walkthrough is deployed publicly at
https://hakuha114-collab.github.io/solana_coralOS/. GitHub Actions runs the React tests, typecheck, and
production build before deployment.

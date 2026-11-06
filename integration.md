# Syndicate integration progress and next steps

## History, exits and claims update — 7 November 2026

Leader bear exits, a persistent follower success dialog with both exits, and `/history` for both roles are implemented. New records verify actual entry/exit transfers and show realized USDC P/L separately from native gas. `Claim Promise` verifies the original Arkiv commitment and publishes/reuses a post-trade result claim; claimed status is read from Arkiv, with unknown states blocked. Earlier Markdown described commitments but no claim-state protocol, so `trade_result_claims` is new. See [TRADE_HISTORY.md](TRADE_HISTORY.md) for behavior and legacy-data limitations.

## Proving-file preparation update — 7 November 2026

The app now self-hosts a fixed, integrity-verified proving-file revision. `/trade` requires explicit preparation of its 75 files (about 179 MiB) in versioned browser Cache Storage before new funding can start. SDK artifact requests read only from that cache during proving; missing files stop the flow rather than triggering GitHub downloads. Build setup downloads/verifies the ignored static files and copies them into the production bundle. Public files are shared per browser origin; wallet keys and notes remain in their existing isolated stores.

## Leader funding integration update — 7 November 2026

The web leader terminal now displays the saved shielded wallet's balances, estimates capital/pool fees plus gas reserves, and creates a locally persisted per-trade burner on submission. Its funding adapter uses the shielded spending/viewing keys to build a multi-asset withdrawal and unwrap native gas; the recipient burner signs the Pimlico UserOperation. Confirmed funding and recipient balances gate promise creation, then the existing entry and signal flow uses the saved burner. Keys and operation state persist for retry/reload/exit. The backend adds a short-lived, authenticated Pimlico RPC session without exposing its API key to the browser. Follower trading still uses its existing static account.

Validation: 12 frontend unit tests and two mocked-chain browser checks passed, plus frontend build and backend syntax checks. No live funded withdrawal/trade was performed. The earlier review below is historical; implementation details and recovery limits are in [SHIELDED_FUNDS.md](frontend/SHIELDED_FUNDS.md).

## Dashboard deposit integration update — 6 November 2026

The dashboard now includes a shared shielded-funds panel for leaders and followers: local shielded wallet creation, MetaMask ETH/USDC/WETH deposits, private-balance/note synchronization, deposit receipt history, and recovery backup/restore. Recovery seeds are persisted in localStorage and Kohaku's full private-note database in IndexedDB, isolated by profile/funding wallet/chain. The SDK generates note randomness and commitments; later nullifier/proof generation will reuse these keys and recovered notes. See [dashboard deposit details](frontend/SHIELDED_FUNDS.md).

Verification: eight recovery/deposit unit tests passed; browser tests passed on production preview and the development server, including real SDK/WASM address creation, reload persistence and mobile layout. Chain/backend responses were mocked; no live deposit or withdrawal was submitted. Trading still uses the existing static burners. The remaining sections below describe the earlier source review and planning baseline.

Reviewed: 6 November 2026 (Asia/Kolkata). Source snapshot: branch `finale`, commit `2f508d2` (includes the trade-integration/main merge).

This report distinguishes code that exists from simulations, standalone components, and intended architecture. “Implemented” means present in source; it does not establish that external services or deployments were exercised successfully during this review. No live trades, subscriptions, or withdrawals were submitted.

## 1. Current position

Syndicate has a web copy-trading demo with identity/profile integration, subscriptions, sequential trade promises, encrypted follower signals, and client-side Sepolia token transfers. A separate Kohaku/Railgun package implements shielding, balance synchronization, and relayed unshielding. These are not yet connected into one treasury-to-pool-to-trading-burner workflow. The mobile trading experience mostly uses local simulated state.

**The leader and follower currently use separate static demo burners. They are not generated per user or per trade.** All web follower copies use the same configured follower burner; separating leader from follower does not isolate multiple followers from each other.

| Component | Status | Evidence and qualification |
|---|---|---|
| World ID login and JWT sessions | Implemented integration | Web IDKit flow; backend RP-context and proof-verification routes; mobile QR/bridge flow also exists. Live proof completion not retested here. |
| Profiles, wallet linking, subscription-fee settings | Implemented | MongoDB-backed profile APIs and web UI. Wallet registration lacks a signed ownership challenge. |
| Leader discovery, following/followers | Implemented | Web discovery, social lists/counts, follow/unfollow APIs. Server-side payment verification and renewal/count consistency remain incomplete. |
| Subscription payment | Partial integration | MetaMask sends ETH on Base Sepolia, then calls the follow API with a hash. Backend currently trusts the supplied hash. |
| Trade promise | Implemented with gaps | HMAC, sequential counter, Arkiv write attempt. No durable enforceable promise-to-execution validation; sequence increment is not concurrency-safe. |
| Encrypted signals | Implemented with fallback | Per-follower MetaMask encryption; AES-GCM fallback; authenticated WebSocket delivery and active-signal API. Server receives/stores plaintext trade parameters. |
| Web follower copy UI | Implemented demo | TTL countdown, decryption gate, custom capital, separate follower burner, entry/exit transfers and receipts. Not autonomous copy execution. |
| Sepolia entry and exit | Implemented transfer demo | Two separate ERC-20 transactions through a shared demo vault wallet. Not an atomic DEX swap or verified Definitive settlement. |
| Definitive Flash | Prototype | Local intent construction/signing, payload inspectors and simulated triggers. No complete quote/order-submission/fill integration found. |
| Kohaku/Railgun | Standalone implemented PoC | Deposit, ERC-20 approval, private balances, proof preparation and Pimlico broadcast. Not imported by main web/backend trade flow. |
| Fresh trading burners | Not implemented | Static keys; “generate burner” in the leader UI creates only a random address string, not a usable keypair. |
| Leader commission | Partial/demo | Subscription payment exists; 30-bps calculations exist. Verified per-trade 67/33 leader/platform distribution is not implemented. |
| Mobile trading | Simulated | Local balances, allocations, leaders, history and simulated execution. Some real auth/profile/discovery APIs exist. |
| EF alternative mempool / Anon-RPC | Not implemented | No EIP-8141/ERC-8421 transaction adapter or Anon-RPC integration found. Prior discussion is design exploration. |
| Judge evidence | Implemented client logger | Downloadable Markdown and transaction/entity links; generated text and fallback identifiers are not proof of external confirmation. |

## 2. Architecture actually present

### Web leader and follower demo

```text
World ID -> JWT -> linked wallet/profile
Follower -> MetaMask subscription payment on Base Sepolia
         -> backend Follow record + Arkiv relationship write attempt

Leader /trade -> /api/trades/promise -> HMAC + trade number + Arkiv write attempt
              -> static leader burner sends USDC to demo vault
              -> demo vault sends WETH to leader burner
              -> in parallel: /api/trades/execute + /api/trades/signal
                                      |
                      active follower lookup -> encrypt -> Arkiv + MongoDB
                                      -> authenticated WebSocket
                                      -> follower decrypts and chooses amount
                                      -> static follower burner performs transfer demo
                                      -> backend execution record
```

Sources: [leader terminal](frontend/src/pages/LeaderTerminalPage.tsx), [follower modal](frontend/src/components/CopyTradeModal.tsx), [signal context](frontend/src/context/SignalContext.tsx), [trade API](backend/src/routes/trade.js), [transfer engine](frontend/src/lib/flashEngine.ts).

### Separate privacy PoC

```text
Configured treasury wallet -> ETH/ERC-20 shielding -> Railgun private notes
Configured shielded keyring -> sync and select spendable notes -> withdrawal proof
Configured AA signer -> signed UserOperation -> Pimlico bundler -> EntryPoint
                     -> privacy paymaster + Railgun fee adapter
                     -> selected asset delivered to destination
```

Sources: [pool client](packages/shielded-pool/src/core/client.ts), [deposit service](packages/shielded-pool/src/services/deposit.service.ts), [unshield service](packages/shielded-pool/src/services/unshield.service.ts), [standalone portal](packages/shielded-pool/scripts/server.ts).

The wrapper uses `Bundler.pimlico`, while the installed Kohaku SDK supplies the privacy-paymaster/fee-adapter flow internally. Users pay withdrawal fees from shielded WETH; Pimlico is not configured here as a sponsorship paymaster. The paymaster's ETH liquidity is treated as an external infrastructure assumption, not a team implementation task.

This fee mechanism covers the submitted withdrawal operation. The current web trading engine separately sends ordinary transactions; it does not currently use that mechanism for its transfers.

### Burner roles and scope

| Role | Current implementation | Intended next behavior |
|---|---|---|
| Treasury/identity wallet | Linked profile wallet and separately configured privacy-portal funding key | Explicitly separate identity, treasury, shielded spending keys and execution keys. |
| Leader trading burner | Fixed `LEADER_BURNER_KEY`/address | Fresh, recoverable user-controlled signer with a lifecycle tied to an order/position. |
| Follower trading burner | Fixed `FOLLOWER_BURNER_KEY`/address, different from leader | Isolated by follower and eventually by position/trade. |
| Demo settlement vault | Fixed wallet/key signs counterparty transfers | Retain only as a labeled test adapter; replace with real execution integration for real trading. |
| Withdrawal AA signer | Privacy portal uses its configured private key both for keyring derivation and `smartAccountPrivateKey` | Test the recipient burner signing its own withdrawal, with shielded authorization kept separate. |

The agreed design candidate removes the extra withdrawal-only “burner 1”: the trading recipient burner signs the UserOperation, and Pimlico submits the outer transaction. It still needs the leader/follower's shielded spending authorization. This is not yet verified end to end in our wrapper. Keep withdrawal and subsequent trade as separate stages; combining them is optional, not a current requirement.

## 3. What has been built, by area

### Identity and subscriptions

- Backend RP-context signing and World ID proof verification, including compatibility paths; JWT-protected APIs and WebSockets.
- Web login, profile editing, wallet linking/unlinking, fee settings, discovery and relationship lists.
- Web subscription sends native ETH to the leader on Base Sepolia; relationship records have a 30-day expiry and an Arkiv write path.
- Gaps: verify receipt, chain, sender, recipient and amount on the backend before granting access; reject reused payments; require wallet-ownership proof; make renewals and follower counts idempotent. Following/follower list queries should consistently filter expired subscriptions.

### Promises, signals and execution records

- Leader UI waits for `/promise`, performs its Sepolia demo transfers, then calls execution-record and signal APIs concurrently.
- Server creates HMAC-SHA256 commitments including a trade index. A server-secret HMAC is not an independently verifiable public commitment scheme by itself.
- Signal fan-out targets active subscribers, encrypts for a registered MetaMask encryption key, and falls back to backend-derived AES-GCM encryption. The fallback sends plaintext numeric fields to the authenticated client.
- WebSocket reconnect, active-signal retrieval, countdown, manual decryption and custom follower amount exist.
- Gaps: `/execute` generates `0xexec_...` rather than persisting/verifying the real hash supplied by the frontend; it can mark records executed without proving settlement.
- `/execute` does not enforce signal expiry, one execution per signal, matching active membership, or a validated promise. Client-side TTL/decryption gates do not enforce these rules server-side.
- `tradePayload.tradeIndex` is sent/stored in route code but is absent from the nested TradeSignal schema. Persist it explicitly so refresh does not default later trades to #1.
- Copy recording uses the signal's burner field, which identifies the leader's supplied burner; record the actual follower execution address separately.

### Arkiv

- Three schema/write paths: 30-day relationships, 10-minute encrypted signals, 30-day promises; MongoDB remains the operational source used for fan-out/history.
- SDK writes and explorer links exist. On failure or missing credentials, helpers return synthetic entity/transaction identifiers with `onChain: false`.
- Promise/signal routes and UI do not consistently propagate that distinction; a fallback key can be presented as if anchored.
- Indexed leader/follower wallet addresses and relationship nullifiers expose social metadata. Rotating private query tags and fixed-size ciphertext padding are described in docs/demo payloads but are not the backend signal-discovery implementation.
- Native TTL controls active availability, not deletion of copies already observed by outsiders. Do not claim ciphertext/metadata becomes unrecoverable after expiry.

### Execution, orders and monetization

- Static leader and follower burners can send USDC to the demo vault; the vault transfers WETH back. Exit controls reverse the transfers and calculate a payout using selected scenario prices.
- Each leg has its own transaction and receipt. A successful first leg is not rolled back if the second fails. The vault is a key-controlled counterparty wallet, not an atomic settlement contract in this repo.
- Entry quantities/prices are selected/calculated by the UI (the leader path uses a fixed WETH position amount); form symbols, sides and order types are not fully routed to corresponding execution behavior.
- `/flash-trade` demonstrates local EIP-712 signing/verification and JSON payloads. Placeholder router/verifying-contract addresses and a displayed API request are not an executed protocol integration.
- Base mode reads balances; the funded broadcast branch wraps ETH into WETH. The unfunded branch fabricates a settlement hash/result. Neither demonstrates a completed Definitive order fill.
- Bracket/TWAP settings, simulated price triggers and fee projections exist. Automated oracle-backed monitoring, persisted OCO enforcement, TWAP scheduling, verified leader performance, and 67/33 fee settlement remain to implement.

### Shielded pool

- Standalone package exposes random/deterministic keyrings, ETH/USDC/WETH shielding, ERC-20 approval execution, balance/note sync, unshield proof creation and bundler broadcast. CLI scripts and a separate multi-asset portal exist.
- `ETH` unshield currently selects the pool's WETH ERC-20 and delivers WETH; it does not unwrap native ETH for the recipient.
- Integration blockers: main backend has no mounted shielded-pool API; the portal has one configured pool instance rather than per-user isolation; the client always uses `MemoryStorage` even though config advertises a storage option; POI is disabled in this PoC.
- `UnshieldResult.userOpHash` is currently the placeholder `0x`; return actual operation/transaction evidence.
- Pool WETH is `0xfff9976782d46cc05630d1f6ebab18b2324d6b14`; trading-demo WETH is `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`. They are different ERC-20 balances. An unshielded pool WETH balance will not satisfy the demo engine's WETH balance checks automatically.
- Chain IDs are configurable in places, but the public client is hardcoded to Sepolia. Resolve configuration before adding other chains.

### Mobile

- Expo 58/React Native application with login, dashboard, discover, profile, theme, copy-allocation modal, shield/unshield UI and activity views.
- World ID bridge/QR polling, backend health/profile/explore calls and an explicit sandbox-login fallback are present. Sandbox fallback can retain a fabricated local session and is not proof of verified identity.
- `TradeContext` seeds demo leaders/history and mutates a local balance for deposits/withdrawals. Allocations and simulated trades remain in local state.
- Native session storage is an in-memory map; web uses localStorage. SecureStore/biometric backup is not implemented.
- No live trading WebSocket/decryption/settlement pipeline, signed delegation or push-notification integration found. Current navigation uses tab state in `App.tsx`; it does not follow the Expo Router requirement in `app/AGENTS.md`.

## 4. Plans versus code

| Planning source | Delivered | Remaining or correction |
|---|---|---|
| [spec.md](spec.md): leader order form | Symbol, side, limit, amount, SL/TP, burner input | Generated address is not a wallet; actual signer and payload can disagree. |
| spec: promise before parallel execution/signal | Promise-first UI; later parallel record/signal calls | Actual transfers occur before those calls; bind promise, receipt and signal durably. Server hashes plaintext input rather than receiving only a client commitment. |
| spec: encrypted follower signals and 10-minute window | Per-follower encryption, storage attempts, WebSockets, UI countdown | Enforce expiry/replay/auth at execution; expose encryption and anchoring fallback accurately. |
| spec: adjustable follower execution | Custom amount and separate follower transfer path | Backend receipt persistence, actual follower address, reliable order status. |
| [app/plan.md](app/plan.md), milestones 1–2 | App scaffold, theme, login/World ID integration | NativeWind strategy and secure persistence differ from plan; validate actual device login and reject synthetic sessions outside demo mode. |
| app plan, milestones 3–4 | Screens and local allocations; some real discovery APIs | Real shielded balances, pool actions, follower subscriptions and EIP-712 delegation. |
| app plan, milestones 5–6 | Simulated activity and UI | Live signals, decryption/signing, push, durable receipt history, backup/biometrics and device QA. |
| [README.md](README.md), [FLASH_TRADE_DOCS.md](FLASH_TRADE_DOCS.md) | Broad demo/UI and explanatory material | Single-use burners, atomic swaps, production Flash settlement, automatic triggers and distributed commissions are ahead of code. |
| [pool README](packages/shielded-pool/README.md) | Standalone deposit/key/balance implementation; unshield also exists in code | Update deposit-focused documentation with current withdrawal behavior, fee token and evidence limitations. |
| [Arkiv docs](arkiv/how-you-use-arkiv.md) and companion files | Schema/write paths, rationale, feedback, reach narrative | Separate confirmed writes from fallbacks; correct rotating-tag/privacy/audit guarantees and distinguish projections from measured adoption. |
| [UI_GUIDELINES.md](UI_GUIDELINES.md) | Shared web tokens/components and transaction displays | Remove fabricated confirmations/default balances from live views; audit responsive/accessibility/reduced-motion behavior rather than assuming compliance. |

The mobile plan has unchecked milestones alongside a checked verification checklist. Neither is an authoritative completion record; use the source-backed statuses above.

## 5. Next-step implementation plan

### P0 — Make the existing demo state trustworthy

- [ ] Define explicit `simulation`, `sepolia-demo` and real-provider modes. Synthetic hashes and Arkiv fallback IDs must never appear as confirmed external evidence.
- [ ] Persist real chain ID, signer/recipient, both transfer hashes, receipt status, and execution mode. Validate receipts server-side; use idempotency keys and resumable partial-failure states.
- [ ] Persist promises and bind execution/signal parameters to them; allocate trade numbers atomically. Store signal trade index and original leader order linkage explicitly.
- [ ] Enforce signal ownership, expiry, active subscription and replay protection before execution authorization; validate subscription payments and signed wallet ownership.
- [ ] Inventory the hardcoded demo signing keys and published mnemonic in source/docs. Treat them as public test credentials; do not use them for real funds. New production signing material must stay out of bundles/logs/Markdown.

Acceptance: database records match real testnet receipts; retrying cannot execute/charge twice; expired/replayed signals and unverified payments are rejected; synthetic evidence is visibly simulated.

### P1 — Connect shielding to the existing static burners first

- [ ] Establish one chain/token registry and resolve the two WETH contracts. Start with USDC principal plus pool WETH for withdrawal fees; explicitly define any later WETH conversion.
- [ ] Introduce a typed per-user pool adapter with isolated keyrings, durable storage and authenticated access. Decide where proofs run and document what the backend can see/sign.
- [ ] Wire deposit preparation/approval/confirmation, note synchronization, private balance and unshield funding into web flow. Preserve spendability and amount precision; never select notes across users.
- [ ] Return actual UserOperation hash and underlying receipt from withdrawal, then gate entry on successful funding confirmation. Add an execution correlation ID independent of identity-wallet addresses.
- [ ] Test the recipient burner as AA signer and destination with a separate shielded keyring, removing the extra withdrawal-only burner if successful. Include insufficient shielded WETH and duplicate/nullifier-spend failure cases.

Acceptance: one leader and one follower independently shield USDC/WETH, fund their respective static burners through the pool, and produce verifiable withdrawal/fee receipts. No direct treasury-to-burner ETH top-up is required for the withdrawal. Subsequent trade gas is a separate execution-adapter concern.

### P2 — Replace static burners with a managed lifecycle

- [ ] Generate real cryptographic keypairs on the user's device or approved wallet infrastructure; isolate each follower and position. Replace random-address-only UI.
- [ ] Persist encrypted recovery material and public execution metadata without publishing a treasury-to-burner map. Define lifecycle: created, funding, ready, position open, closing, retired.
- [ ] Keep a burner usable for the lifetime of its position/exit orders; do not discard it after entry. Decide whether proceeds remain, move to a new burner, or re-shield.
- [ ] Test two concurrent followers and two sequential leader trades: no shared keys, note reuse or balance mixing; recovery works after restart.

Acceptance: new positions have distinct usable signers; entry and exit use the intended account; private key material is absent from public bundles and logs.

### P3 — Implement the actual execution provider and commission

- [ ] Confirm supported provider networks, real contract/domain addresses and API flow before replacing placeholders. Resolve the network boundary: Ethereum Sepolia assets do not appear on Base merely because the address is identical; no bridge exists here.
- [ ] Implement a provider adapter for quote, approval/permit, signing, submission, order status, fills and cancellation. Keep the demo vault adapter available only in demo mode.
- [ ] Route symbol, side, amount units, limit and slippage to actual execution; use integer token units. Add genuine bracket/OCO and TWAP behavior only where supported and verified.
- [ ] Implement persistent position/exit reconciliation and fee accounting. Distinguish the existing subscription fee from any per-trade commission; verify leader/platform payouts from receipts.

Acceptance: provider-issued order IDs resolve to real fills with correct assets/amounts; exit conditions/cancellation work; fees reconcile to actual transfers. No simulation hash counts as settlement.

### P4 — Bring mobile onto the shared flow

- [ ] Reuse backend contracts for real subscriptions, balances, note funding, signals and execution history; replace local seeded trading state in live mode.
- [ ] Choose mobile signing/encryption support, implement secure persistence/recovery, and bring navigation into agreement with `app/AGENTS.md`.
- [ ] Add authenticated reconnecting WebSockets, expiry/decryption UI and live copy confirmation; push notifications are a separate background-delivery task.
- [ ] Perform iOS/Android device QA for World ID, wallet requests, interrupted funding, reconnect and expired orders.

Acceptance: a web leader signal reaches a real mobile follower who decrypts/authorizes it and sees confirmed execution; restart preserves recoverable state.

### P5 — Evidence, documentation and optional EF work

- [ ] Add focused tests for subscription/payment verification, commitment binding, signal expiry/replay, encryption isolation, partial execution and per-user keys. Split offline unit tests from network-dependent pool integration tests.
- [ ] Make judge reports consume actual receipts/provider results; label estimates, synthetic states and live service failures. Refresh README, Flash and Arkiv docs against this report.
- [ ] Document the real privacy boundary: server plaintext access; public Arkiv relationships; reused wallets; logs; RPC metadata. An encrypted signal is not anonymity for its participants.
- [ ] If targeting the alternative-mempool track, build a separate EIP-8141 devnet adapter/paymaster demonstration and retain its admitted transaction evidence. The ERC-4337 Pimlico flow does not establish that integration. Anon-RPC is another optional workstream.

Acceptance: a reproducible demo has confirmed evidence for every claimed integration; optional EF work has its own tested execution path and clearly stated trade-offs.

Recommended immediate order: **P0 receipt/state correctness -> P1 pool-funded static-burner demo -> P2 burner isolation/rotation -> P3 real execution -> P4 mobile parity.** P5 evidence work runs alongside each stage. Validate the provider/network choice early because it can change the funding design. Do not expand to new protocols before the existing funding/execution boundary is demonstrated.

## 6. Verification and review scope

| Check during this review | Result |
|---|---|
| Backend JavaScript syntax (`node --check` across `backend/src`) | Passed. |
| Shielded package TypeScript build (`npm run build`) | Passed. |
| Frontend TypeScript + Vite build (`npm run build`) | Passed; Vite reported a bundle-size warning. |
| Shielded package tests (`npm test`) | Could not pass in this environment: Sepolia RPC DNS/fetch failure during initialization (`eth_chainId`); two tests failed and four skipped. This does not verify or disprove funded withdrawals. |
| Live World ID, MongoDB, Arkiv, Definitive, paymaster receipts | Not exercised during this review. |
| Mobile runtime/device QA | Not performed; source inspection only. |

Reviewed all repository Markdown sources outside generated/dependency folders: root `README.md`, `spec.md`, `FLASH_TRADE_DOCS.md`, `UI_GUIDELINES.md`; `packages/shielded-pool/README.md`; `app/plan.md`, `app/AGENTS.md`; and all five files under `arkiv/` (`schema.md`, `how-you-use-arkiv.md`, `why-arkiv.md`, `friction.md`, `reach.md`). Their claims were compared with implementation, rather than treated as evidence of deployment or completion.

This review adds documentation only; it does not implement the outstanding work or rotate existing burners.

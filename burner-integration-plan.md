# Per-trade burner and shielded funding integration

Status: proposed for review; implementation has not started.
Prepared: 6 November 2026. Scope: web leader and follower trading flows.

This proposal replaces the static-burner-first sequencing in integration.md P1/P2. Fresh burners and shielded funding will be delivered together, starting with a small browser integration proof.

## 1. Agreed target

- Generate a real burner keypair on the user's device when they confirm a new trade. Each leader position and each follower copy gets a separate burner.
- Save the burner private key and lifecycle record in that browser's localStorage before moving funds. Sign locally; never submit private keys to our backend.
- Fund the burner through the shielded pool. The original connected wallet signs pool deposits through MetaMask, including token approval when necessary.
- The recipient burner is also the EIP-7702 account/UserOperation signer submitted to Pimlico. There is no additional withdrawal-only burner.
- Keep the user's shielded spending keyring separate from the per-trade burner. The keyring authorizes spending private notes; the burner authorizes the UserOperation.
- Retain the burner through entry, exits and recovery. A retry resumes the same trade; a genuinely new trade creates a new burner.
- Preserve the existing execution adapter in this workstream. Replacing the demo transfers with Definitive settlement is separate work.

## 2. Target flow

```text
Leader confirms trade / follower confirms decrypted copy
  -> create local trade ID and fresh burner; persist key and state
  -> load this user's local shielded keyring and synchronize notes
  -> calculate trade capital, withdrawal fee and execution gas requirement
  -> if private balance is insufficient:
       connected original wallet -> MetaMask approval/deposit -> shielded pool
       wait for successful receipt AND spendable private notes
  -> build withdrawal to the new burner using the user's shielded keyring
  -> burner locally signs EIP-7702 authorization/UserOperation
  -> Pimlico submits -> EntryPoint/privacy paymaster -> pool withdrawal
  -> verify successful operation receipt and recipient balances
  -> execute trade with the same local burner
  -> persist real receipts and position; retain key for exit/recovery
```

MetaMask authorizes the public wallet-to-pool leg, not a direct transfer to the burner. Reuse existing spendable private balances when sufficient; otherwise deposit the shortfall just in time. ERC-20 approval, principal deposit and fee-token deposit can require several MetaMask confirmations, rather than one popup.

The existing privacy-paymaster mechanism charges shielded WETH for withdrawal. Its ETH liquidity remains an infrastructure assumption. Principal and fees can come from different private notes; a USDC note is not treated as containing WETH.

Just-in-time deposits and withdrawals can be correlated by amount and timing. This flow must not be described as guaranteeing that the original wallet and burner cannot be linked.

## 3. Local accounts and persistence

| Material | Lifetime | Storage/use |
|---|---|---|
| Original wallet private key | Existing wallet | Stays in MetaMask; never requested or exported |
| Shielded spending/viewing keyring | Persistent per local user/wallet/chain | Generated locally; persisted for note access and recovery |
| Burner private key | One trade/position including exits | localStorage as requested; used by local signing code |
| Trade/operation record | Through settlement and recovery | localStorage; backend receives necessary public execution evidence only |

Use cryptographic key generation through the existing wallet library, not Math.random. Derive the displayed address from the saved key and verify it when loading. Fail before funding if persistence fails.

Namespace local records by application version, authenticated profile, connected wallet, chain and local trade ID. Store amount values as integer strings with token address/decimals, never serialized floating-point balances. Include role, source signal/promise ID, address, stage, transaction hashes, UserOperation hash, position details and recoverable errors.

The shielded keyring must be recoverable independently of an individual burner; do not recreate it on every trade. Make backup/export and restore available for local signing material. Clearing browser storage or changing devices otherwise loses access. localStorage is readable by scripts running on the same origin; it is the requested PoC persistence choice, not an encrypted hardware-backed wallet.

On wallet/account/chain changes, suspend the active flow and reload the correct namespace. Serialize note spending per shielded wallet across tabs and concurrent trades. Persist pending submissions before permitting retries; reconcile chain state before constructing a replacement operation.

## 4. Implementation order

### Phase 1: verify the browser withdrawal path

Before wiring both trading screens:

1. Load the pinned Kohaku SDK and WASM in Vite/browser, with appropriate asset loading and lazy initialization.
2. Create a persistent local shielded keyring and a separate fresh local burner.
3. Prepare a deposit into that keyring and submit it with the connected MetaMask wallet.
4. Synchronize notes and withdraw to the burner, using that same burner as the AA signer.
5. Capture the actual UserOperation hash, transaction hash, receipt status and resulting balance.
6. Reload and verify that the same keyring and burner resume correctly.

The source exposes separate shielded and smart-account signers and constructs the smart account at the signer's address. This supports the proposed design, but the complete browser flow remains unverified. Treat successful execution as a gate, not an assumption. Do not fall back to uploading the burner key or using the existing shared server keyring.

The pinned SDK's broadcast method currently returns void and discards its receipt. Add a maintained adapter/SDK patch exposing submission and receipt results, including operation success; do not scrape console logs or edit node_modules manually.

### Phase 2: shared browser wallet and funding services

Create shared modules for:

- Burner creation, persistence, lookup, recovery and retirement.
- Local shielded-keyring initialization and durable pool storage. The wrapper currently ignores its storage option and always uses MemoryStorage.
- MetaMask connection/network checks, allowance checks, required approvals, deposit transactions and receipt validation. Process all SDK-required deposit transactions, rather than assuming only the first matters.
- Pool synchronization, spendable-balance checks and fee estimation.
- Withdrawal construction, local burner signing, submission and receipt reconciliation.
- A resumable funding controller used by both leader and follower screens.

Use the existing portal as a reference for the MetaMask experience, not its singleton server-side pool instance. Pool secrets and proof construction remain client-side. If a backend proxy is needed to protect the Pimlico API credential, it forwards only permitted RPC requests and signed operations; it never receives private keys.

Use one explicit chain/token registry. Initial scope is Ethereum Sepolia. Pool WETH and the current demo trading WETH have different addresses: preserve their distinction and use the pool's wrapped token for withdrawal fees. Do not combine balances merely because both have the symbol WETH.

### Phase 3: make the newly funded burner executable

The current trade adapter sends ordinary transactions, so a fresh burner also needs native ETH for those transactions. The withdrawal paymaster covers the withdrawal operation, not these later sends.

Verify a pool-funded native-ETH reserve using the same burner as recipient and executor. The installed SDK exposes multi-asset unshielding and native unwrap calls, but our wrapper currently maps ETH to ERC-20 WETH. Test and expose the supported path before relying on it. Prefer principal plus native reserve in one supported withdrawal; otherwise use a separately confirmed pool-funded operation. Include entry and expected exit costs in the reserve estimate and keep paymaster fee WETH separate.

If native delivery is unsupported in this deployment, report that specific blocker before treating funding-to-trading as complete. Do not silently add a direct original-wallet-to-burner top-up.

### Phase 4: leader integration

1. Replace the static default and random-address generator with the persisted per-position burner.
2. Freeze the submitted trade inputs and assign a local correlation ID.
3. Run the shared funding flow and display its actual progress.
4. Once funded, create the existing trade promise with the actual burner address, then execute with its local key. Preserve promise-before-trade ordering.
5. Submit actual execution evidence and the existing signal after confirmed entry.
6. Bind exit controls and refreshed balance displays to the saved position's burner.

Remove the implicit static-key fallback from the execution engine. All entry and exit callers must provide the intended account. Funding failures must not publish a successfully executed trade or signal.

### Phase 5: follower integration

1. Preserve signal decryption, chosen copy amount and existing subscription/expiry gating.
2. Create a new local burner for this follower's copy, then run the same funding controller against this follower's shielded wallet.
3. Recheck expiry and authorization after potentially slow deposits/proof preparation and immediately before executing.
4. Execute and record the follower's actual burner and receipts; keep leader identity/burner metadata in separate fields.
5. Keep the saved burner for follower exits and page-reload recovery.

If the signal expires after funding, leave a recoverable funded burner and do not automatically trade. Duplicate clicks, reconnects and retries must not create additional funded burners or execute the same copy twice.

### Phase 6: records, recovery and verification

Use a persisted state machine:

```text
created -> awaiting-deposit -> syncing-notes -> preparing-withdrawal
        -> withdrawal-pending -> funded -> entry-pending -> position-open
        -> exit-pending -> closed
```

Allow explicit failure/recovery states at each stage; skip deposit stages when already funded privately. Track individual transactions within multi-step stages. A submission timeout is pending/unknown until reconciled, not an instruction to resend.

Update execution records to store real transaction hashes, chain, actual signer, operation status and idempotency/correlation IDs. The current backend fabricates an execution hash and ignores the submitted one; fix that for the integrated path. Verify receipts and the relevant transfer evidence before recording execution. Never send local key material to trade, signal, Arkiv, telemetry or logging endpoints.

Retire burners only after the position is closed and remaining assets/pending operations have been handled. Automatic re-shielding of proceeds is a separate extension; initial recovery must retain the key and expose remaining balances rather than silently deleting it.

## 5. Acceptance checks

- Two leader trades and two independent follower copies produce four distinct, usable burners.
- Original-wallet funding shows MetaMask confirmations and deposits into the correct user's shielded wallet.
- The new recipient burner signs the UserOperation while holding no initial native ETH; Pimlico submission and paymaster settlement succeed.
- Withdrawal uses the correct private principal and fee notes, with confirmed actual operation/transaction evidence.
- The same burner receives principal, obtains the required execution gas through the verified pool path, enters and exits the existing demo position.
- Reloads restore keys and pending state; duplicate submissions and concurrent note spends are prevented/reconciled.
- Rejected approvals/deposits, insufficient fee WETH, RPC timeouts, reverted operations and signal expiry produce recoverable states without false success.
- Backend records the actual leader/follower execution address and real receipts. Browser network inspection shows no private-key or mnemonic transmission.
- Frontend/package builds and focused lifecycle, persistence, funding and reconciliation tests pass; controlled Sepolia end-to-end runs provide the integration evidence.

## 6. Boundaries for this review

Included: web browser persistence/signing, MetaMask shielding, separate local shielded wallets, per-trade burners, recipient-signed Pimlico withdrawal, execution handoff, receipt correctness and recovery.

Separate work: mobile parity, replacing the demo vault with Definitive, automated order strategies, commission redesign, alternative mempool deployment and production wallet custody design.

No application code, dependencies, deployed contracts or live transactions were changed while preparing this plan.

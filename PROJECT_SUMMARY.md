# Project Summary

**Updated:** 7 November 2026  
**Project:** Shielded copy-trading proof of concept

## What the project does

The web app demonstrates a trusted leader publishing a trade signal and followers copying it. It combines a Kohaku/Railgun shielded pool for deposits and private withdrawals with a Pimlico UserOperation flow and a testnet trade-vault demo.

This is a testnet proof of concept, not a complete exchange integration. The current trade demo moves ERC-20 tokens through a key-controlled vault in separate transactions. It does not execute an atomic swap or verify a fill on Definitive.

## Agreed transaction flow

1. A leader or follower deposits ETH, USDC, or WETH from their original wallet into their shielded pool using MetaMask.
2. Their persistent shielded wallet stores the keys and notes needed to spend those funds later.
3. For a leader trade, the browser creates a temporary burner account and stores its private key locally. The shielded pool withdraws USDC for the position and WETH that is unwrapped into native ETH for the burner’s trade gas.
4. The burner signs the UserOperation sent through Pimlico. It then submits the trade and can later submit a manual bull or bear exit.
5. The leader publishes an encrypted signal. A follower decrypts it with MetaMask, funds and executes a copy, and can exit from the success dialog or trade history.
6. A completed trade can link its pre-trade promise to verified entry and exit results in Arkiv.

The privacy wallet authorizes shielded spends; it is not the burner’s transaction signer. MetaMask is used for original-wallet funding and follower signal decryption. The follower’s trade-funding flow still uses a static burner and is not yet the same fresh, shielded-funded flow as the leader.

## Pimlico and gas

Pimlico is used as the ERC-4337 bundler. The current Kohaku setup also relies on its configured shared privacy paymaster and fee adapter. The shielded pool supplies the withdrawal-fee asset (WETH); the paymaster’s EntryPoint deposit reimburses the bundler. A common paymaster is public infrastructure, not a shielded pool, and does not by itself conceal who funded its deposit.

The withdrawal’s gas handling does not pay the burner’s later ordinary trade gas. The leader flow withdraws and unwraps a native ETH reserve for that later transaction. USDC principal and WETH fee funds are separate shielded notes, not one multi-asset note.

## Implemented

- **Dashboard deposits:** role-specific shielded wallet setup, ETH/USDC/WETH deposits, note sync, balance display, and backup/restore.
- **Shielded storage:** wallet seed and derivation data in browser local storage; SDK note database and sync state in IndexedDB. Backups are currently unencrypted and must be kept secure.
- **Leader funding:** local per-trade burner creation, shielded balance and fee checks, proof preparation, Pimlico submission, retry checkpoints, and confirmation before proceeding to the trade and signal.
- **Proof files:** pinned proving-artifact manifest and verified build-time preparation; trade UI can cache files before use. Proof generation reads the local cache rather than downloading from GitHub at runtime.
- **Follower copy:** MetaMask signal decryption and a recovery action to refresh the encryption key and retry. The user confirmed this resolved their decryption issue.
- **Receipts and records:** backend verifies Sepolia ERC-20 transfers and stores actual entry/exit receipts, gas, and amounts. Duplicate recording and exit retries are handled.
- **Exits and history:** manual bull/bear exits, follower success dialog, and a shared history view for both roles with receipt-backed realized P/L and separate native-gas display.
- **Promise linking:** claim action links a completed trade result to its pre-trade Arkiv commitment. It is a result attestation, not a payout claim. Existing claims are checked to avoid duplicate writes.
- **RPC reliability:** Pimlico proxy returns JSON-RPC errors consistently; requests use keep-alive transport, pacing, deduplication, short-lived caches, and 429 backoff.

## Findings and verified behavior

- The leader previously appeared to fail the fee-reserve check even with enough WETH because the check omitted the SDK’s fee convergence allowance. It now checks the prepared UserOperation’s estimated maximum fee plus the native-gas reserve against synchronized shielded WETH.
- Proving artifacts failed because of GitHub redirect/CORS behavior, Brotli response handling, and an empty URL on cached responses. These paths were fixed and the proof files are prepared locally.
- A Pimlico proxy mounted behind generic authentication returned a non-JSON response that broke the SDK parser. Route ordering and JSON-RPC error envelopes were corrected; the proxy was also moved to Axios keep-alive after fetch timeouts.
- A follower copy was verified from Sepolia receipts: 2 USDC moved to the demo vault, then 0.000670 WETH returned to the follower. The two receipts used 96,584 gas combined. This is a two-transfer demo, not a quoted or guaranteed exchange fill.
- The pool’s Sepolia WETH (`0xfff9976782d46cc05630d1f6ebab18b2324d6b14`) differs from the trade demo WETH (`0x7b79995e5f793a07bc00c21412e50ecae098e7f9`). Their balances are not interchangeable.
- Recent frontend and backend tests passed, the frontend build passed, and the trade-history browser check passed. The user reported that the leader flow looked good. No live exit or Arkiv result claim was submitted as part of those checks.

## Important limitations and next work

1. Give followers the leader’s fresh per-trade burner and shielded-pool funding flow.
2. Replace the demo vault transfers with the intended real trade/settlement integration; add verified execution prices and automated order/exit behavior if required.
3. Complete and test real exit and promise-result claim transactions end to end. Current result claims are backend-verified Arkiv attestations, not a new public zero-knowledge proof.
4. Improve durable key/backup handling and bring the mobile app to parity; the mobile trading experience is still largely a separate prototype.
5. Finish wallet-ownership and subscription-receipt verification where required. Some signal metadata and trade parameters are visible to the server or public Arkiv records, so the current system does not guarantee full unlinkability.
6. Treat the alternative mempool/EIP-8141 track as a separate architecture investigation; it is not a setting for the current Pimlico/ERC-4337 flow.

## Related notes

- [Shielded funds integration](frontend/SHIELDED_FUNDS.md)
- [Trade history, exits, and promise claims](TRADE_HISTORY.md)
- [Integration progress log](integration.md)

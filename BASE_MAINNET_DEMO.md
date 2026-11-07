# Base mainnet demo

## Current direct-wallet mode

Base now uses fixed, externally funded wallets: leader `0x4DF9aB442f076cf039B0C322Aae89Cc4990dE50D`, follower `0xd4F497e055fdd783767f55b92De0090a920E5fd9`. The trade UI shows the address and has no fund, sweep, rotate or prototype-pool controls. Select the corresponding MetaMask account to approve tokens and sign real Definitive entry/protective orders. No private keys are hardcoded, no fresh burner is funded, and Base preparation no longer uses Pimlico. Sepolia keeps its shielded/Pimlico flow.

Completed fixed-wallet attempts are archived before a new attempt; a BUY position must finish its protective exit before the next demo trade. Existing local burner keys are retained for recovery. Live receipt verification, automatic protection, history and promise-result linking remain enabled.

The following sections describe the earlier burner-funding implementation and its original balance checks.


Implemented 7 November 2026. This mode uses real Base funds, Pimlico UserOperations and Definitive Flash execution. Base funding is public; the Sepolia shielded-pool integration remains a separate mode.

The leader and follower interfaces show a pool-to-burner routing diagram labeled **Prototype**. It represents the intended shielded flow without inventing a shielded balance, commitment or withdrawal proof. Expandable demo funding details and wallet confirmations retain the actual MetaMask source.

## Demonstration flow

1. Sign in with the leader profile and select its linked MetaMask account on Base. The default BUY size is 0.50 USDC.
2. Submit the trade. A fresh local burner is reserved for it, and the pre-trade promise is sealed. MetaMask requests the required USDC and native ETH funding transfers automatically. The native reserve is 0.00005 ETH; already confirmed funding is reused on retries.
3. The recipient burner signs an EIP-7702 / EntryPoint 0.8 UserOperation. Pimlico batches input-token approval and the bounded WETH allowance for the protective exit. The burner pays this preparation's gas from its own ETH. No sponsor/paymaster funding or shielded withdrawal is claimed.
4. The burner signs the actual Definitive entry and attached protective-order payloads. The app refreshes the quote after preparation, submits it, waits for a real fill, and verifies the Base receipt before recording execution and dispatching the signal.
5. The follower decrypts the signal and submits its selected copy amount. It gets its own burner and the same funding, Pimlico and Definitive sequence, with the leader's protective price levels.
6. Definitive executes the protective exit when its trigger is reached. The success panel checks every 12 seconds; history checks every 15 seconds while a Base BUY remains open. Verified exit amounts update the position to closed and supply realized USDC P/L. Claim Promise then uses the existing Arkiv commitment/result linking flow.

## Quick-exit pricing

BUY quotes derive the reference price from the live received WETH's notional value and quantity. Take profit is reference × 1.0005 and stop loss is reference × 0.9995. These are real attached market-exit triggers, not simulated price changes. The leader's commitment retains the chosen levels through retries.

A trigger within a couple of minutes is possible but cannot be guaranteed. Either exit can realize a net loss because execution spread, fees and slippage are separate from the reference-price trigger. SELL entries do not attach protection to the received USDC; use BUY for the complete entry/protection demonstration.

## Funds checked before implementation

| Role | Original Base wallet | ETH | USDC |
| --- | --- | --- | --- |
| Leader | `0x4DF9aB442f076cf039B0C322Aae89Cc4990dE50D` | 0.001012268243507081 | 0.55 |
| Follower | `0xd4F497e055fdd783767f55b92De0090a920E5fd9` | 0.0005 | 0.55 |

Both can fund one 0.50-USDC demo and the chosen native reserve at the observed gas rates. Balances and fees can change. A read-only 0.50-USDC quote succeeded, but its output was valued at roughly $0.437, illustrating the cost of tiny trades. Capital and exit proceeds stay in each burner until recovered; original-wallet balances do not automatically include them.

## Recovery and configuration

- Burner keys are scoped by profile and original wallet and archived before rotation. Do not clear local storage. The older global Base key is left intact; it is not silently assigned to another profile.
- Funding hashes, signed UserOperation bytes and hash, promise, Definitive quote/order IDs and settlement hashes are saved. Retries reuse the signed operation and resume order confirmation. An uncertain Definitive submission without an order ID stops automatic resubmission for reconciliation.
- Base sessions are bound to chain 8453 and burner address. Pimlico credentials stay on the backend.
- Optional RPC settings: frontend `VITE_BASE_RPC_URL`; backend `BASE_RPC_URL`. Backend `DEFINITIVE_API_KEY` may override the public development integrator key used by this demo; the browser currently uses that documented public development key.
- Mainnet receipt verification rejects invented hashes and placeholder amounts. Unsupported multiple-fill or mismatched full-position exits stop reconciliation instead of fabricating results.
- Sepolia manual bull/bear actions cannot execute against Base positions. Base history links use BaseScan.
- The existing manual sweep currently returns native ETH only. Token recovery must include the remaining USDC/WETH before clearing burner storage or attempting another demo with the same original-wallet capital.

## Validation

Read-only checks confirmed Base EntryPoint 0.8 availability through the configured Pimlico key, deployed Simple7702 account code, live quotes, and attached protective signing payloads. Automated checks cover scoped keys, bounded quote inputs, actual receipt amounts, protective-exit P/L, chain-bound proxy routing, retry reuse, history links and claim controls. No mainnet order or funding transaction was submitted during implementation; a live wallet-approved run is still required.

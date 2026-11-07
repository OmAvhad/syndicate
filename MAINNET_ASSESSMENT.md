# Base mainnet integration assessment

Initial assessment. The chosen public-funding implementation and subsequent fixes are documented in [BASE_MAINNET_DEMO.md](BASE_MAINNET_DEMO.md); the SDK support limitation below still applies.

Checked 7 November 2026 using read-only Base RPC calls, the installed SDK, and an unsigned Definitive quote. No funds moved and no order was signed or submitted.

## Blocker for the existing private Pimlico flow

The installed `@kohaku-eth/railgun@0.0.1-alpha.31` was initialized and its actual WASM `chainConfig` queried:

| Network | Chain ID | SDK configuration available |
| --- | --- | --- |
| Ethereum mainnet | 1 | Yes |
| Base mainnet | 8453 | No |
| Ethereum Sepolia | 11155111 | Yes |

Our existing private funding path requires that configuration's Railgun deployment, privacy paymaster, fee adapter, wrapped token and sync infrastructure. Changing the Pimlico endpoint to Base does not supply them. Do not reuse Sepolia contract addresses on Base or treat publicly funded Base UserOperations as shielded withdrawals.

The current Base mode funds its burner directly from MetaMask, then signs a Definitive intent. The shielded dashboard and withdrawal path remain on Sepolia. A Base privacy deployment/integration must be selected and verified before implementing the equivalent private flow there. Ethereum mainnet is another SDK-supported direction, but would require funds on Ethereum and separate mainnet configuration and verification.

## Observed wallet balances

| Role | Address | Base ETH | Base USDC | Base WETH |
| --- | --- | --- | --- | --- |
| Leader | `0x4DF9aB442f076cf039B0C322Aae89Cc4990dE50D` | 0.001012268243507081 | 0.55 | 0 |
| Follower | `0xd4F497e055fdd783767f55b92De0090a920E5fd9` | 0.0005 | 0.55 | 0 |

RPC confirmed chain ID 8453. Gas price at observation was 0.006 gwei; unsigned USDC approval estimates were 56,216 gas for each wallet. That is approximately 0.000000337296 ETH of execution gas, excluding Base's additional fee components. Both ETH balances provide substantial headroom for several simple Base transactions at that observed rate; this is not an estimate for an undeployed private flow.

A read-only leader BUY quote for 0.50 USDC returned HTTP 200 and a signing payload, with approximately 0.000194975503194537 WETH output valued by the API at $0.436611. Small trades can have material execution losses even when the displayed estimated fee is zero. Quotes expire and must be refreshed.

These balances appear sufficient for a small direct-funded Base swap demonstration after code corrections. They do not establish that the full private deposit/withdrawal/trade/exit flow is available or affordable. Original-wallet balances also do not mean a burner or shielded wallet is funded.

## Required Base trading corrections

- Prepare and approve the quote's input asset: USDC for WETH BUY, WETH for SELL. Use quote amounts and token decimals.
- Respect follower copy capital instead of the hardcoded BUY quantity.
- Track order completion, verify Base receipts and actual quantities, and remove fabricated transaction IDs and verified flags.
- Implement Base exits, fee accounting and result claims; existing exits use the Sepolia demo vault.
- Archive burner keys per user and position before rotation, include WETH in balance checks, and support token recovery.
- Validate typed-data chain, contracts, recipient, amounts and expiry before signing; confirm approval/wrap receipt success.
- Estimate Base's total fees for sweeps rather than only 21,000 times gas price.

## Next implementation decision

Choose a verified Base privacy integration, use the supported Ethereum-mainnet Kohaku path, or explicitly accept a publicly funded Pimlico flow on Base. The last option can use a bundler but does not preserve the shielded funding privacy of our Sepolia architecture.

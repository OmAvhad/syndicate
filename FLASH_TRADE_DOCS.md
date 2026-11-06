# ⚡ SyndicateCopy — Flash Trade Technical & Architecture Documentation

> **Status:** Active Hackathon Architecture Documentation (ETHGlobal Mumbai 2026)  
> **Target Track:** Definitive — *Best Use of Flash Advanced Orders in a Social App* ($2,500)  
> **Privacy Layer:** Kohaku / Railgun Privacy Pool on Ethereum Sepolia  
> **Route in App:** [`/flash-trade`](http://localhost:5173/flash-trade) (Stand-alone demo, no login required)

---

## 1. Overview & Purpose

**SyndicateCopy** solves a major structural flaw in copy trading: today, a top trader’s wallet is public, so bots can trade ahead of followers (frontrunning), copycats copy for free, and leaders cannot monetize their edge.

SyndicateCopy introduces **Zero-Link Burner Trading** and **Sealed Signals**:
1. **Leaders trade from single-use burner wallets** funded through a private pool (**Kohaku / Railgun** on Ethereum Sepolia), leaving zero onchain link to their identity or profile.
2. **Advanced order types run on Definitive Flash**: Every entry attaches a **Bracket Order** (Stop-Loss + Take-Profit) in one signed transaction.
3. **Follower copy protection**: Followers execute copies using **TWAP (Time-Weighted Average Price) split orders**, diffusing buy volume across multiple small buckets so MEV bots cannot frontrun.
4. **Built-in Monetization**: Every executed trade automatically attaches a **30 bps (0.3%) protocol fee**, split 67% to the leader's private address and 33% to the platform treasury.

---

## 2. Hardcoded Testnet Credentials (Ethereum Sepolia & Arkiv Rabdi)

For testing and hackathon judging, the application preloads verified Ethereum Sepolia and Arkiv Rabdi testnet accounts derived from the project mnemonic, funded and aligned with the Kohaku / Railgun privacy engine:

```text
Mnemonic: "honey gadget trigger smooth menu okay luxury walk refuse behind cushion color"
```

### Account 0 — Leader Primary Wallet (Index 0)
- **Role:** Trader Main Identity, Funding Treasury, and Gas Broadcaster
- **Address:** [`0x9C14b0Ffe97c3074C71314D3a330b5F847bf2294`](https://sepolia.etherscan.io/address/0x9C14b0Ffe97c3074C71314D3a330b5F847bf2294)
- **Private Key:** `0xd8b5ae7e766afb0c8acaf43b2a973083ab128e595da9be91ca1f66fac72a0c55`
- **Network:** Ethereum Sepolia Testnet (L1)

### Account 1 — Leader Burner Wallet (Index 1) — *Primary Leader Execution*
- **Role:** Anonymous Single-Use Trade Execution Burner for Leaders (Funded via Kohaku / Railgun)
- **Address:** [`0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9`](https://sepolia.etherscan.io/address/0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9)
- **Private Key:** `0x188fe782457952a2218796912dafea24d0554d167afd17796d576faa77633875`
- **Network:** Ethereum Sepolia Testnet (L1)
- **Current Live Balances:** ~`0.0075 ETH`, `20.17 USDC`, `0.000 WETH`
- **Export Symbol in Code:** [`LEADER_BURNER_ADDRESS`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L24), [`LEADER_BURNER_KEY`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L25)

### Account 2 — FlashTradePool Vault (Index 2) — *Settlement & Liquidity Vault*
- **Role:** Dedicated Settlement Vault & Liquidity Counterparty Pool
- **Address:** [`0xA360946725811DABB91C054A3DFF25eD25C005E8`](https://sepolia.etherscan.io/address/0xA360946725811DABB91C054A3DFF25eD25C005E8)
- **Private Key:** `0x5299ad8d435a01383b00d555c4414186ace307e42f42991ba08a83505cb3ed6b`
- **Purpose:** Receives trade entry capital ($X$), holds escrow during open positions, and executes automated payout transfers ($X + Y$) upon Take-Profit / Bull run exits while retaining the 30 bps protocol fee.
- **Network:** Ethereum Sepolia Testnet (L1)
- **Current Live Balances:** ~`0.019 WETH`, ~`38.83 USDC`
- **Export Symbol in Code:** [`FLASH_TRADE_POOL_ADDRESS`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L20), [`FLASH_TRADE_POOL_KEY`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L21)

### Account 3 — Follower Dedicated Burner Wallet — *Isolated Copy Execution*
- **Role:** Dedicated Anonymous Copy Execution Burner for Followers (Isolated from Leader funds)
- **Address:** [`0x915E5004F52F934717D8938638A991470FE03AF6`](https://sepolia.etherscan.io/address/0x915E5004F52F934717D8938638A991470FE03AF6)
- **Private Key:** `0xec21abb2f5c1838d80d40ecc8608e4c88ecf5bfd824f6eee35dc2a450e224fec`
- **Network:** Ethereum Sepolia Testnet (L1)
- **Funded Balances:** `0.004 Sepolia ETH` (tx [`0x09d813...`](https://sepolia.etherscan.io/tx/0x09d813b0e4bfffa268fc38ab821be73ab4e9736b69ddb1ef6ee4c857f59d3b23)), `15.00 USDC` (tx [`0xffbf9d...`](https://sepolia.etherscan.io/tx/0xffbf9d1623d35386663fba1b99a8c3eec63bf2314664d3cdcfd0ef1a8be911e0)), `0.000 WETH`
- **Why a Separate Follower Burner?**  
  In earlier testing, both the leader and follower shared Account 1 (`0x2e5B...`). This created cross-contamination where executing a follower copy deducted capital from the leader's balance, and exiting one position left the other position open. By partitioning into **Dedicated Leader** and **Dedicated Follower** burners, both parties have completely independent balances, individual WETH positions, and can trigger onchain Bull/Bear exits simultaneously without race conditions.
- **Export Symbol in Code:** [`FOLLOWER_BURNER_ADDRESS`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L28), [`FOLLOWER_BURNER_KEY`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L29)

### Account 4 — Arkiv Relayer & World ID Signer Wallet
- **Role:** Gas relayer for Arkiv onchain operations & EIP-712 World ID v4 Auth Relayer
- **Address:** [`0x0962cC66c69426C32574447cF50fe9664fE94451`](https://rabdi.explorer.arkiv.network/address/0x0962cC66c69426C32574447cF50fe9664fE94451)
- **Derived From:** `SIGNER_KEY` (`0xd3109bfed18f988a34ae8b8f379c48b6083d5fa6a1aff9fc58e2deb06044fd59`) in `backend/.env`
- **Network:** Arkiv Rabdi Testnet (Chain ID: `7794095`)
- **Balance:** **`10.0 tGLM`** (Funded and verified live on Rabdi testnet)
- **Functions:**
  1. Signs IDKit v4 `rp_context` payload for verifying human World ID credentials.
  2. Submits onchain `createEntity` transactions sealing 30-day Trade Promises (`trade_promises`), 30-day Follower Relationships (`follower_relationships`), and 10-minute Trade Signals (`trade_signals`) directly onto the Arkiv Rabdi testnet.

---

## 3. End-to-End Protocol Lifecycle: Leader Promise, Two-Leg Execution, Signals & Follower Copy

The following sequence diagram illustrates the entire end-to-end journey from leader order creation to follower copy and real onchain exit settlement:

```mermaid
sequenceDiagram
    autonumber
    actor Leader as Leader Trader (Burner: 0x2e5B...57F9)
    participant UI_L as Leader Terminal (/leader-terminal)
    participant Relayer as Syndicate Relayer & Arkiv Node
    participant ArkivNet as Arkiv Rabdi Testnet (0x0962...4451)
    participant Sepolia as Ethereum Sepolia & Vault (0xA360...05E8)
    participant WS as WebSocket Relay Service
    participant UI_F as Follower Desk (/dashboard)
    actor Follower as Follower Trader (Burner: 0x915E...3AF6)

    Note over Leader,UI_L: Step 1: Sequential Trade Promise
    Leader->>UI_L: Input Order: BUY ETH/USDC @ $3000 (Capital $3.00, TP $3350, SL $2800)
    UI_L->>Relayer: POST /api/trades/promise (HMAC tradeData + tradeIndex)
    Relayer->>ArkivNet: storeTradePromiseInArkiv (Schema: trade_promises, 30d retention)
    ArkivNet-->>Relayer: Sealed Entity Key (0x3d15...3621) + Tx Hash
    Relayer-->>UI_L: Return promiseId & Arkiv Explorer URL

    Note over Leader,Sepolia: Step 2: Atomic Two-Leg Execution
    UI_L->>Sepolia: Leg 1: Leader Burner transfers $3.00 USDC to FlashTradePool Vault
    Sepolia-->>UI_L: Mined (Etherscan Leg 1)
    UI_L->>Sepolia: Leg 2: Vault transfers 0.001 WETH to Leader Burner
    Sepolia-->>UI_L: Mined (Etherscan Leg 2)
    Note over Leader,Sepolia: Leader holds 0.001 WETH. Balance: 17.17 USDC + 0.001 WETH

    Note over Relayer,WS: Step 3: Signal Encryption & 10m TTL
    UI_L->>Relayer: POST /api/trades/signal (Order fill payload)
    Relayer->>Relayer: Query active followers & encrypt payload with follower public key (AES-256-GCM)
    Relayer->>ArkivNet: storeTradeSignalInArkiv (Schema: trade_signals, 10-min TTL)
    Relayer->>WS: Broadcast trade_signal event to active human followers

    Note over UI_F,Follower: Step 4: Real-Time Follower Notification & Copy
    WS-->>UI_F: Real-Time Signal Banner pops up: "New Signal: BUY ETH/USDC @ $3,000"
    Follower->>UI_F: Click "Review & Copy" -> Opens CopyTradeModal
    Follower->>UI_F: Enter Custom Allocation (e.g. $1.50 USDC -> 0.0005 WETH)
    UI_F->>Sepolia: Execute Copy via Follower Burner (0x915E...3AF6)
    UI_F->>Sepolia: Leg 1: Follower Burner transfers $1.50 USDC to Vault
    UI_F->>Sepolia: Leg 2: Vault transfers 0.0005 WETH to Follower Burner
    Sepolia-->>UI_F: Copy Mined Onchain! Follower position active.

    Note over Leader,Follower: Step 5: Market Exit Settlement (Bull Move @ $3,350)
    Leader->>UI_L: Click "🚀 Bull Move ($3,350)" -> Take-Profit Hit (+11.30% Net)
    UI_L->>Sepolia: Reverse Leg 1: Leader Burner returns 0.001 WETH to Vault
    UI_L->>Sepolia: Reverse Leg 2: Vault transfers $3.34 USDC (Principal + Net Profit) to Leader Burner
    Sepolia-->>UI_L: Exit Mined! Leader USDC restored to 20.17 USDC (+0.70 USDC net profit)

    Follower->>UI_F: Click "🚀 Bull Move ($3,350)" in CopyTradeModal
    UI_F->>Sepolia: Reverse Leg 1: Follower Burner returns 0.0005 WETH to Vault
    UI_F->>Sepolia: Reverse Leg 2: Vault transfers $1.67 USDC (Principal + Net Profit) to Follower Burner
    Sepolia-->>UI_F: Exit Mined! Follower USDC restored to 15.17 USDC (+0.17 USDC net profit)
```

### Detailed Breakdown of the Steps:

#### 1. Leader Order Input & Arkiv Sequential Promise Sealing
- **Endpoint:** `POST /api/trades/promise`
- **What happens:**
  1. The leader selects their trading pair (`ETH/USDC`), side (`BUY`), order type (`BRACKET`), entry limit (`$3,000`), trade capital (`$3.00 USDC`), Take-Profit target (`$3,350`), and Stop-Loss floor (`$2,800`).
  2. The server increments the leader's sequential trade counter (`tradeIndex: 1, 2, 3...`) stored in MongoDB and computes an HMAC payload hash:
     $$\text{hash} = \text{HMAC-SHA256}(\text{tradeIndex} + \text{symbol} + \text{side} + \text{limit} + \text{amount} + \text{burnerAddress}, \text{secretKey})$$
  3. The relayer signs and broadcasts an onchain `createEntity` transaction to **Arkiv Rabdi Testnet** using schema `trade_promises` with a 30-day immutable audit retention.
  4. Returns the sealed entity key (e.g. `0x3d1566e6bc977b4c3701745f9bb54a1c3d8828707455167c23df807d77583621`) and links to the [Arkiv Rabdi Explorer](https://rabdi.explorer.arkiv.network/entity-explorer).

#### 2. Real Atomic Two-Leg Swap on Ethereum Sepolia
- **Module:** [`executeTwoLegSwap`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/lib/flashEngine.ts#L79)
- **What happens:**
  1. **Leg 1:** Leader Burner (`0x2e5B...57F9`) transfers `$3.00 USDC` to the `FlashTradePool` Vault (`0xA360...05E8`) on the canonical Circle Sepolia USDC contract (`0x1c7D...7238`).
  2. **Leg 2:** `FlashTradePool` Vault immediately executes the counterparty leg, transferring `0.001 WETH` directly into the Leader Burner on the canonical WETH9 contract (`0x7b79...e7f9`).
  3. Real transaction receipts are confirmed on Ethereum Sepolia, providing authentic Etherscan links.

#### 3. Signal Encryption & Arkiv Real-Time Dissemination
- **Endpoint:** `POST /api/trades/signal`
- **What happens:**
  1. The leader terminal informs the relayer that the order has filled.
  2. The server queries active human followers from MongoDB and Arkiv (`follower_relationships`).
  3. The trade signal payload is encrypted using each follower's public key via **AES-256-GCM** with 512-byte fixed-length padding (preventing traffic analysis).
  4. The encrypted envelope is written to **Arkiv** under schema `trade_signals` with a **strict 10-minute TTL (`600s`)**. After 10 minutes, Arkiv nodes automatically prune the entity from state, permanently preventing alpha leakage.
  5. The signal is simultaneously pushed in sub-50ms via WebSockets (`broadcastTradeSignal`) to all connected active follower sessions.

#### 4. Follower Notification & Proportional Copy Execution
- **Component:** [`CopyTradeModal.tsx`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/components/CopyTradeModal.tsx)
- **What happens:**
  1. Follower receives an amber live trade banner in real time with an audio/visual cue.
  2. Clicking "Review & Copy" opens the modal displaying the leader's entry price, bracket targets, and duration remaining on the 10-minute TTL.
  3. **Custom Capital Allocation:** Follower can adjust copy amount (e.g., $1.50 USDC instead of the leader's $3.00 USDC).
  4. Follower clicks "Confirm & Copy Trade":
     - The transaction executes via the **Dedicated Follower Burner (`0x915E...3AF6`)**.
     - Follower Burner transfers `$1.50 USDC` to Vault; Vault transfers `0.0005 WETH` to Follower Burner.
     - Follower position status switches to **ACTIVE (0.0005 WETH)** with live unrealized PnL tracking.

#### 5. Dual Onchain Exit Settlements (Bull Move & Bear Dump)
- Both Leader and Follower have interactive exit buttons directly in their interfaces:
  - **🚀 Bull Move (Take-Profit Trigger @ $3,350):**
    - Triggers Take-Profit onchain settlement:
    - Burner returns WETH to FlashTradePool Vault.
    - Vault releases gross proceeds in USDC:
      $$\text{Payout} = \text{Principal} + (\text{Capital} \times 11.67\%) - 30\text{ bps protocol fee} = \text{Principal} + 11.30\%\text{ Net Gain}$$
    - For $3.00 entry: returns **$3.34 USDC** (+0.34 net profit).
    - For $1.50 entry: returns **$1.67 USDC** (+0.17 net profit).
  - **📉 Bear Dump (Stop-Loss Trigger @ $2,800):**
    - Triggers Stop-Loss defensive exit onchain settlement:
    - Burner returns WETH to Vault; Vault refunds remaining capital:
      $$\text{Refund} = \text{Principal} - (\text{Capital} \times 6.67\%) = \text{Principal} - 6.67\%$$
    - For $3.00 entry: returns **$2.80 USDC** (-$0.20 loss).
    - For $1.50 entry: returns **$1.40 USDC** (-$0.10 loss).
- Verified on Etherscan: both WETH and USDC balances update in real time on the blockchain.

---

## 4. Recent UX & Platform Enhancements

### 1. Dedicated Burner Partitioning
- Separated `LEADER_BURNER_KEY` and `FOLLOWER_BURNER_KEY` to guarantee that multi-user testing in split-screen or separate browser sessions never collides or interferes with token allowances or open WETH positions.

### 2. Inline Account Numbers for Small Networks (< 3 Accounts)
- In [`Dashboard.tsx`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/pages/Dashboard.tsx), [`ProfilePage.tsx`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/pages/ProfilePage.tsx), and [`LeaderTerminalPage.tsx`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/pages/LeaderTerminalPage.tsx):
  - When the user has `< 3` followers or is following `< 3` accounts, the interface displays their truncated wallet addresses inline directly on the card with one-click clipboard copy chips.
  - Eliminates the need to click into sub-modals just to verify who is subscribed.

### 3. MetaMask Connection Prompt Banner
- When a user signs in via World ID (verifying their uniqueness as a human) but hasn't yet connected their Web3 wallet, an amber notification banner ([`MetaMaskPromptBanner.tsx`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/components/MetaMaskPromptBanner.tsx)) prompts them to connect MetaMask.
- In the navigation header, the raw hex nullifier is cleanly replaced with a green `Verified Human` badge, and an integrated [`WalletConnectButton`](file:///Users/omkar/projects/syndicate-ethmumbai/frontend/src/components/WalletConnectButton.tsx) enables 1-click wallet linking.

### 4. Interactive Judge Log Export (`output.md`)
- Both the Leader Terminal and Flash Trade Desk aggregate all live protocol steps into `window.judgeLogs`.
- Hackathon judges can click **"Download Judge Logs (.md)"** to immediately receive a formatted Markdown export of all signed EIP-712 orders, Arkiv sealed entities, and Etherscan transaction receipts.

---

## 5. Network & Onchain Infrastructure

| Resource | Specification | Details |
|---|---|---|
| **Settlement Network** | Ethereum Sepolia Testnet (L1) | Chain ID: `11155111` |
| **Data Anchoring Network** | Arkiv Rabdi Testnet | Chain ID: `7794095` (Gas currency: `tGLM`) |
| **Production Execution** | Base Mainnet (L2) | Chain ID: `8453` (Sub-second execution) |
| **Sepolia RPC Endpoint** | `https://ethereum-sepolia-rpc.publicnode.com` | Direct JSON-RPC connection via `viem` |
| **Arkiv RPC Endpoint** | `https://rabdi.rpc.arkiv.network` | Arkiv Rabdi JSON-RPC |
| **Sepolia Explorer** | [Etherscan Sepolia](https://sepolia.etherscan.io) | Public testnet ledger verification |
| **Arkiv Explorer** | [Arkiv Rabdi Explorer](https://rabdi.explorer.arkiv.network/entity-explorer) | Decentralized entity storage explorer |
| **WETH9 Contract** | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` | Official Ethereum Sepolia Wrapped Ether contract |
| **USDC Contract** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Official Circle USDC contract on Sepolia |
| **Privacy Pool** | Kohaku / Railgun | Onchain private pool on Ethereum Sepolia |
| **Definitive Flash Settlement** | `0x1111111111111111111111111111111111111111` | Verifying settlement contract domain |
| **ERC-4337 EntryPoint** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Canonical ERC-4337 EntryPoint contract |

---

## 6. Understanding "Simulate" vs. "Execute"

The `/flash-trade` terminal features two primary buttons. Here is exactly what each does:

### A. What "Simulate Flash Order" Does (Offchain Cryptographic Intent)
- **Cost:** **$0 (Zero Gas)**. Does not require spending testnet ETH.
- **Workflow:**
  1. Computes the **Definitive Flash Quote**: Calculates entry pricing ($3,000/ETH), slippage bounds (0.5%), and the 30 bps protocol fee breakdown ($1.50 total: $1.00 to leader, $0.50 to platform).
  2. Constructs the **EIP-712 Typed Data** intent per Definitive Flash specifications.
  3. **Signs the message offchain** using the hardcoded private key (`walletClient.signTypedData`). This produces a 65-byte cryptographic signature (`0x...`).
  4. Cryptographically verifies the signature on-client using `verifyTypedData` to ensure mathematical validity.
  5. Computes the **Syndicate Pre-Trade Sealed Commitment**:
     $$\text{commitment} = \text{keccak256}(\text{walletAddress} + \text{tradeSeq} + \text{salt})$$
  6. Computes the **Arkiv rotating tag** (`t_...`) with a 10-minute auto-expiration TTL.
- **Why this matters for judges:** Intent-based architectures (Flash, UniswapX, CoW Swap) separate *signing the intent* from *mining the transaction*. The user signs offchain, and the Flash solver network executes it when conditions are met.

---

### B. What "Execute on Ethereum Sepolia" Does (Two-Leg Onchain Atomic Swap)
- **Cost:** Real Ethereum Sepolia gas (< 0.0002 ETH).
- **Two-Leg Workflow:**
  1. **Leg 1/2 (USDC Spend):** Trader transfers trade capital (e.g. `$3.00 USDC`) directly to the **FlashTradePool Vault** (`0xA360...05E8`) on the Circle Sepolia contract (`0x1c7D...7238`).
  2. **Leg 2/2 (WETH Position Acquisition):** The FlashTradePool Vault counterparty immediately fulfills the order by transferring the purchased asset (`amountEth`, e.g. `0.001 WETH`) directly into the Trader's wallet on the canonical WETH9 contract (`0x7b79...e7f9`).
  3. **Onchain Balance Result:**
     - Trader USDC decreases by `$3.00` and Trader **WETH increases by +0.001 WETH**!
     - FlashTradePool USDC increases by `+$3.00` and FlashTradePool WETH decreases by `-0.001 WETH`.

---

### C. What "Execute Take-Profit / Stop-Loss Exit" Does (Reverse Onchain Settlement)
- **Cost:** Real Ethereum Sepolia gas.
- **Two-Leg Exit Workflow:**
  1. **Exit Leg 1/2 (Position Close):** Trader closes their long position by returning the `0.001 WETH` back to the FlashTradePool Vault.
  2. **Exit Leg 2/2 (Payout with Profit):** FlashTradePool releases the gross exit value (original capital + bull run profit, e.g. `$3.34 USDC`) to the Trader in USDC.
  3. **Onchain Balance Result:**
     - Trader **WETH decreases by -0.001 WETH** (position fully closed)!
     - Trader **USDC increases by +$3.34** (profit fully locked in)!
     - FlashTradePool receives the WETH back and pays out the USDC.

---

## 7. Actual JSON Payloads & Transaction Data

The terminal includes an interactive **Live JSON Transaction & Protocol Payloads** inspector displaying three distinct schemas:

### Payload 1: Definitive Flash EIP-712 Order Intent
This is the structured payload signed by the trader’s wallet and settled offchain by Definitive Flash:

```json
{
  "domain": {
    "name": "Definitive Flash",
    "version": "1",
    "chainId": 11155111,
    "verifyingContract": "0x1111111111111111111111111111111111111111"
  },
  "types": {
    "Order": [
      { "name": "quoteId", "type": "string" },
      { "name": "funder", "type": "address" },
      { "name": "pair", "type": "string" },
      { "name": "spendAsset", "type": "string" },
      { "name": "spendAmount", "type": "string" },
      { "name": "side", "type": "string" },
      { "name": "amount", "type": "string" },
      { "name": "orderType", "type": "string" },
      { "name": "takeProfit", "type": "string" },
      { "name": "stopLoss", "type": "string" },
      { "name": "feeBps", "type": "uint256" }
    ]
  },
  "primaryType": "Order",
  "message": {
    "quoteId": "q_flash_sepolia_11155111_17",
    "funder": "0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9",
    "pair": "ETH/USDC",
    "spendAsset": "USDC",
    "spendAmount": "$1.50",
    "side": "BUY",
    "amount": "0.0005",
    "orderType": "bracket",
    "takeProfit": "$3300.00",
    "stopLoss": "$2850.00",
    "feeBps": "30"
  },
  "signature": "0xab5eebdeb8b9af02ec283070c531fa...",
  "status": "VALIDATED_AND_CRYPTOGRAPHICALLY_SIGNED"
}
```

---

### Payload 2: Raw EVM Onchain Transaction & Receipt
This is the transaction broadcast to the Ethereum Sepolia RPC node:

```json
{
  "network": "Ethereum Sepolia Testnet (L1)",
  "chainId": 11155111,
  "rpcEndpoint": "https://ethereum-sepolia-rpc.publicnode.com",
  "pair": "ETH/USDC",
  "executionLeg": "ENTRY_USDC_TRANSFER",
  "transactionPayload": {
    "from": "0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9",
    "to": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    "targetContract": "Circle USD Coin (USDC)",
    "function": "transfer(address to, uint256 value)",
    "functionSelector": "0xa9059cbb",
    "action": "Transfer USDC trading capital into settlement vault on Ethereum Sepolia",
    "valueUsdc": "$15.00 USDC",
    "calldata": "0xa9059cbb (transfer $15.00 USDC to 0x9C14b0Ff...)"
  },
  "executionStatus": "MINED_ONCHAIN",
  "receipt": {
    "transactionHash": "0x6cd2316850f2a2c1deaf83f3c259faf63d9f0e63095238e99ba3c55276280443",
    "blockNumber": 7824150,
    "gasUsed": "45210",
    "status": "success",
    "etherscanUrl": "https://sepolia.etherscan.io/tx/0x6cd2316850f2a2c1deaf83f3c259faf63d9f0e63095238e99ba3c55276280443"
  }
}
```

---

### Payload 3: Arkiv Sealed Envelope & Zero-Link Commitment
This is the cryptographic commitment broadcast to Arkiv so followers can open the signal while keeping the trader anonymous:

```json
{
  "protocol": "SyndicateCopy Privacy Engine",
  "boardTarget": "Arkiv Rabdi Testnet (Chain ID: 7794095)",
  "sealedEntity": {
    "type": "SyndicateSealedPromise",
    "tradeSequence": 17,
    "broadcaster": "0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9",
    "commitmentHash": "0xa8b193d3aadd0a03d43c52fac82ae76252c86afe7c1240ea9474b055eb6e3180",
    "secretSalt": "0x0f478c45255170bc28fa2ec9d6ac9b435f29903d76c2bd639c17e041f827bd42",
    "rotatingTag": "t_669c1b34c5a6824a",
    "timeToLiveSeconds": 600,
    "encryptionStandard": "AES-256-GCM + 512-Byte Fixed Padding"
  },
  "anonymityGuarantee": "Zero-Link: No onchain link exists between this burner wallet and the leader profile until post-trade reveal (Railgun / Kohaku privacy pool)."
}
```

---

## 8. How to Run & Verify

1. Start the application:
   ```bash
   npm run dev:frontend
   ```
2. Navigate to: **[http://localhost:5173/flash-trade](http://localhost:5173/flash-trade)**
3. Verify live balance on Ethereum Sepolia.
4. Click **"Simulate Flash Order"** &rarr; Verify the EIP-712 signature in the JSON Payload tab.
5. Click **"Execute via Burner on Ethereum Sepolia"** &rarr; View the mined transaction directly on [Etherscan](https://sepolia.etherscan.io).

---

## 9. Internal Team Primer & Glossary (New to Flash Trading?)

This section is written specifically for our team members who are new to Definitive Flash, advanced orderbooks, or zero-knowledge copy trading.

### ❓ Core Concepts Explained Simply

#### 1. What is Definitive Flash?
- **In Plain English:** Traditional DEXes (like Uniswap v2/v3) only let you do simple immediate swaps ("Swap X for Y now"). If you want automated conditional orders (like "Sell when price hits \$3,300" or "Stop loss at \$2,850"), you either have to leave a bot running with custody of your funds or write complex, gas-heavy onchain orderbook contracts.
- **Definitive Flash Solution:** Flash lets users sign an **offchain intent** (an EIP-712 cryptographic message). A decentralized network of Flash solvers settles the trade automatically onchain when your market conditions are met.

#### 2. What is a Bracket Order?
- **Definition:** A 3-in-1 bundled order:
  1. **Entry Order:** Buy ETH at current market/limit price (\$3,000).
  2. **Take-Profit (TP):** Automatically triggers a sell when ETH climbs to \$3,300 (+10%).
  3. **Stop-Loss (SL):** Automatically exits the trade if ETH drops to \$2,850 (-5%).
- **Why Leaders Love It:** Priya (the trader) places **one single order** before she steps away. Flash handles the automatic take-profit and defensive stop-loss on its own.

#### 3. What is a TWAP Order?
- **Definition:** Time-Weighted Average Price. Instead of buying \$500 worth of ETH in one sudden burst, the order is sliced into 3 smaller chunks over 3–5 minutes.
- **Why Followers Need It:** When a popular trader releases a signal, hundreds of followers buying at the exact same second would cause huge price slippage and invite MEV frontrunning bots to sandwich-attack them. TWAP diffuses the buys over time, neutralizing bots.

#### 4. Why WETH instead of native ETH?
- **Technical Detail:** Native ETH is the base gas currency of Ethereum, but it was created before the ERC-20 token standard existed.
- **The Solution:** Smart contract routers and orderbooks cannot easily handle raw native ETH. Wrapping ETH into **WETH9** converts it 1:1 into an ERC-20 token (`0x7b79...e7f9` on Sepolia) that smart contracts can approve, transfer, and trade seamlessly.

#### 5. Why EIP-712 Intent Signing instead of a standard transaction?
- **Technical Detail:** When you sign an EIP-712 message, you are not sending a transaction to the blockchain. You are producing a cryptographic digital signature that proves: *"I, owner of wallet 0x..., authorize this exact trade with these exact limits."*
- **The Benefit:** It costs **\$0 in gas** to place, modify, or cancel orders offchain. Only the final settlement touches the chain.

#### 6. What is a Zero-Link Burner Wallet?
- **The Problem Today:** If Priya trades from her known public wallet, everyone copies her for free, and bots frontrun her.
- **Syndicate Solution:** Priya's identity is verified via **World ID** (proving she is 1 unique human), but her trading capital sits in a private pool powered by **Kohaku / Railgun** on Ethereum Sepolia. For each trade, she generates a brand-new burner wallet with no prior history and zero public link to her. She only reveals the link *after* the trade closes to prove her track record.

---

## 10. Deep-Dive: How Price Movement & Triggers (TP/SL) Work

This section explains the exact mechanics behind price determination, oracle data feeds, and how Definitive Flash keepers trigger Take-Profit and Stop-Loss orders.

```mermaid
sequenceDiagram
    autonumber
    actor Trader as Leader / Trader (Burner Wallet)
    participant UI as Syndicate /flash-trade Terminal
    participant Flash as Definitive Flash Relayer / Solvers
    participant Oracle as Price Oracle (Pyth / Chainlink)
    participant Sepolia as Ethereum Sepolia Settlement & WETH
    participant Follower as Followers (via Arkiv TWAP)

    Trader->>UI: Configure Bracket Order (Entry: $3,000, TP: $3,300, SL: $2,850)
    UI->>Trader: Sign EIP-712 Order Intent ($0 Gas)
    Trader-->>UI: Cryptographic Signature (0x...)
    UI->>Flash: Register Intent in Flash Offchain Orderbook
    UI->>Sepolia: Execute Entry Leg (Wrap ETH -> WETH Collateral)
    Sepolia-->>UI: Receipt Confirmed (Deposit Mined)

    loop Continuous Price Monitoring Loop
        Flash->>Oracle: Query Latest Real-Time ETH/USD Price Feed
        Oracle-->>Flash: Return Current Market Price (e.g. $3,350)
        Flash->>Flash: Evaluate Trigger Invariants: (Price >= $3,300? OR Price <= $2,850?)
    end

    Note over Flash,Sepolia: Condition Met: $3,350 >= $3,300 (Take-Profit Triggered!)
    Flash->>Sepolia: Submit Settlement Transaction with EIP-712 Signature
    Sepolia->>Sepolia: Verify Oracle Proof + Signature + Invalidate SL (OCO)
    Sepolia->>Sepolia: Swap WETH -> Proceeds + Deduct 30 bps Protocol Fee
    Sepolia-->>Trader: Transfer Profit to Trader Wallet
    Sepolia-->>Follower: Broadcast Trigger Event to Arkiv for Follower Exits
```

### 1. How is Price Movement Determined in Crypto?
Unlike centralized stock exchanges where a single central matching engine dictates prices, decentralized finance (DeFi) determines prices via two primary layers:

1. **Spot DEX Automated Market Makers (AMMs):**
   - On DEXes like Uniswap v3 on Ethereum, prices are dictated by the ratio of tokens pooled together:
     $$x \cdot y = k$$
   - When traders buy ETH using USDC, ETH is pulled out of the pool and USDC is deposited. The pool now has less ETH and more USDC, causing the spot price of ETH to rise.
   - When traders sell ETH for USDC, ETH is added to the pool and USDC is extracted, causing the spot price to fall.
2. **Decentralized Price Oracles (The Source of Truth):**
   - Relying on a single DEX pool's spot price is dangerous because an attacker could execute a multi-million-dollar flash loan to manipulate the pool for a single transaction.
   - Definitive Flash relies on robust decentralized oracles:
     - **Chainlink Data Feeds:** A consortium of independent node operators aggregate spot prices from major global exchanges (Binance, Coinbase, Kraken, OKX) and publish medianized price updates to Ethereum Sepolia (e.g. ETH/USD Aggregator: [`0x694AA1769357215DE4FAC081bf1f309aDC325306`](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306)).
     - **Pyth Network (Low-Latency Pull Oracle):** High-frequency publishers stream sub-second price feeds offchain. Solvers attach a signed Pyth price proof directly into the settlement transaction.
     - **DEX TWAP (Time-Weighted Average Price):** A rolling 30-minute geometric mean price that filters out short-term flash loan anomalies.

---

### 2. How Definitive Flash Determines if SL or TP is Triggered

When you submit a Bracket Order on Flash, you do **not** have an active transaction sitting on the blockchain waiting for price to change (which would be enormously expensive). Instead, the order is managed by an **Offchain Solver / Keeper Network**:

#### Step 1: Offchain Invariant Registration
Your signed EIP-712 message contains exact mathematical invariants:
- **Take-Profit (TP) Target:** $\$3,300.00$
- **Stop-Loss (SL) Floor:** $\$2,850.00$
- **Entry Benchmark:** $\$3,000.00$

#### Step 2: Continuous Solver Evaluation Loop
Automated keeper bots operated by Flash run an algorithmic evaluation loop:

```typescript
// Pseudocode running inside Flash Keeper / Solver nodes
async function monitorBracketOrders(orders: FlashOrder[]) {
  const currentPrice = await getOraclePrice("ETH/USD"); // e.g. from Chainlink or Pyth

  for (const order of orders) {
    if (order.status !== 'ACTIVE') continue;

    // Condition A: Take-Profit Trigger
    if (currentPrice >= order.takeProfitPrice) {
      console.log(`🎯 Take-Profit triggered for order ${order.id} at $${currentPrice}`);
      await executeOnchainTrigger({
        order,
        triggerType: 'TAKE_PROFIT',
        oraclePrice: currentPrice,
        signature: order.signature
      });
      order.status = 'FILLED_TAKE_PROFIT';
    }
    // Condition B: Stop-Loss Trigger
    else if (currentPrice <= order.stopLossPrice) {
      console.log(`🛡️ Stop-Loss triggered for order ${order.id} at $${currentPrice}`);
      await executeOnchainTrigger({
        order,
        triggerType: 'STOP_LOSS',
        oraclePrice: currentPrice,
        signature: order.signature
      });
      order.status = 'FILLED_STOP_LOSS';
    }
    // Condition C: Price remains within bounds
    else {
      // Position remains open. Zero gas consumed.
    }
  }
}
```

---

### 3. One-Cancels-the-Other (OCO) Protection

A critical requirement in bracket trading is ensuring that if Take-Profit executes, Stop-Loss cannot subsequently execute (or vice versa):

1. **Settlement Smart Contract State:**
   - When the solver submits the winning leg to the Definitive Flash settlement contract, the contract verifies the trader's EIP-712 signature and confirms that the oracle price satisfies the condition.
   - The contract marks the order's unique `orderHash` or `nonce` as **FILLED** in onchain storage.
2. **Invalidation of Opposing Leg:**
   - If market volatility causes the price to crash to $\$2,850$ five minutes later, any attempt by a bot to trigger the Stop-Loss will revert onchain with `Error: OrderAlreadyFilled()`.
   - The user's position is safely closed and capital returned.

---

### 4. What Happens When You Click "Execute via Burner on Ethereum Sepolia" in the Demo?

When you press the execution button in `/flash-trade`:

1. **Direct RPC Broadcast:**
   - The application uses `viem` to construct an Ethereum transaction from your selected hardcoded testnet wallet (Burner or Treasury).
2. **Canonical Contract Call:**
   - It targets the official Ethereum Sepolia **WETH9 contract** (`0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`).
   - Function selector: `0xd0e30db0` (`deposit()`).
   - Attached Value: `0.0005 ETH` (or your chosen amount).
3. **Mined Onchain:**
   - The transaction is broadcast to `https://ethereum-sepolia-rpc.publicnode.com`, mined into a real block on Ethereum Sepolia, and verified on Etherscan.
4. **Token Wrapping Realized:**
   - Your wallet's native testnet ETH balance decreases by the trade amount + gas.
   - Your wallet's ERC-20 **WETH token balance increases by the exact trade amount**, ready to serve as trade collateral for the Flash settlement router.
5. **JSON Payloads Updated:**
   - The UI's JSON Inspector immediately unlocks the actual mined receipt, block number, gas used, and explorer URL.

---

### 5. Interactive Price Simulation in the UI

In our `/flash-trade` terminal, we built an interactive price simulation engine under **"Price Movement & Trigger Check"**:
- **Scenario Buttons:**
  - 🚀 **Bull Move (\$3,350):** Immediately trips the `price >= $3,300` threshold &rarr; shows Take-Profit execution with +11.7% profit.
  - ⚖️ **Neutral (\$3,020):** Stays within the \$2,850–\$3,300 channel &rarr; position remains open in active monitoring.
  - 📉 **Bear Dump (\$2,800):** Trips the `price <= $2,850` threshold &rarr; shows defensive Stop-Loss triggering to protect capital.
- **Continuous Slider (\$2,600 to \$3,600):** Drag in real time to observe the exact moment the keeper solver's boolean logic flips from `MONITORING` to `TRIGGERED`.

---

### 6. Does the "Bull Move" Work in Only Simulation or Execute on Ethereum Sepolia Also?

This is a critical distinction to understand for our demo and judges:

#### A. The Price Itself ($3,350) is a Simulated Oracle Condition
In the real world, the global market price of Ethereum only moves when millions of dollars of trading volume flow through major centralized exchanges (Binance, Coinbase) and decentralized pools (Uniswap, Curve).  
Neither we nor the hackathon judges can artificially force the live global price of Ethereum to suddenly jump to $\$3,350$ on demand during a 3-minute hackathon pitch.  
Therefore, the **Bull Move (\$3,350)** and **Bear Dump (\$2,800)** buttons simulate what happens when the Chainlink / Pyth price oracle reports that price to the Definitive Flash solver network.

#### B. The Triggered Action DOES Execute on Ethereum Sepolia!
Once the simulated oracle trips the Take-Profit or Stop-Loss condition, you can **execute the actual settlement leg on Ethereum Sepolia**:
1. When you click **🚀 Bull Move ($3,350)**, the Take-Profit condition (`Price >= $3,300`) fires.
2. A live onchain execution button appears:  
   **`⚡ Execute Take-Profit Exit on Ethereum Sepolia ($3,350)`**
3. When clicked, **FlashTradePool Vault (`0xA360946725811DABB91C054A3DFF25eD25C005E8`)** broadcasts a real onchain USDC payout transaction to the Burner trader:
   - Target: Circle Sepolia USDC contract (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`).
   - Function: `transfer(address to, uint256 value)`.
   - Value: Original capital $X$ ($15.00) + Bull Profit $Y$ (+$1.75) - 30 bps Protocol Fee (-$0.05) = **$16.70 USDC**!
4. **Where does that extra $Y$ profit come from?**
   - **In Production DeFi:** The underlying ETH was purchased on a DEX AMM pool (Uniswap v3). As ETH appreciated from $3,000 &rarr; $3,350, the DEX pool yields $16.75 USDC upon exit. The extra $Y$ is paid by the DEX buyers / market counterparties.
   - **In our Sepolia Demo:** **`FlashTradePool`** acts as the automated settlement liquidity provider, transferring the full return ($X + Y$) directly back to the Burner wallet onchain.
5. You get an authentic Etherscan transaction link proving that the profit was credited on the live Ethereum Sepolia blockchain.

#### C. The Complete End-to-End Testnet Journey You Can Show Judges:
```
[1. Entry Leg]
Click "Execute via Burner on Ethereum Sepolia" 
→ Mined: Transfers $15.00 USDC from Burner to FlashTradePool Vault (0xA360...05E8)
        ↓
[2. Intent Sign]
Click "Simulate Flash Order" 
→ Signed offchain EIP-712 Bracket Intent ($0 gas)
        ↓
[3. Market Movement]
Click "🚀 Bull Move ($3,350)" 
→ Flash solver detects Price >= $3,300 target
        ↓
[4. Exit Settlement]
Click "⚡ Execute Take-Profit Exit on Ethereum Sepolia"
→ Mined: FlashTradePool transfers $16.70 USDC ($X + $Y profit) back to Burner!
```

---

## 11. Comprehensive FAQ: Custody, Authority, Reverse Swaps & Simulation Mechanics

This section answers the fundamental questions regarding how non-custodial custody works, how the protocol gets authority over user balances, how automated reverse swaps occur without the user, and how our Ethereum Sepolia testnet demo mirrors production architecture.

```mermaid
flowchart TD
    subgraph NonCustodial["1. Non-Custodial Authority"]
        A["User Wallet (Trader)"] -- "1. Signs EIP-712 Intent ($0 Gas)" --> B["Offchain Intent Pool"]
        A -- "2. Approves Token Allowance (Permit2 / WETH)" --> C["Flash Settlement Contract"]
    end

    subgraph Monitoring["2. Automated Keeper Monitoring"]
        D["Keeper / Solver Bot Network"] -- "Continuously queries" --> E["Pyth / Chainlink Price Oracle"]
        D -- "Evaluates order conditions" --> B
    end

    subgraph Settlement["3. Reverse Swap Execution"]
        E -- "Price >= $3,300 (Take-Profit Triggered!)" --> D
        D -- "Submits Intent + Oracle Proof + User Signature" --> C
        C -- "Verifies ecrecover(sig) == User & Price Valid" --> C
        C -- "Executes Reverse Swap (WETH -> ETH/USDC)" --> F["Ethereum Sepolia DEX Liquidity / WETH"]
        C -- "Delivers 100% Proceeds directly to" --> A
        C -- "Deducts 30 bps Protocol Fee" --> G["Platform Treasury & Leader Note"]
    end
```

---

### Q1: How does custody work? Does the user send their money to Definitive Flash?

**Short Answer:** **NO.** Definitive Flash is **100% non-custodial**. The user never sends money to Definitive Flash as a company, nor into any centralized custodian.

#### The Technical Architecture:
In traditional centralized exchanges (Binance, Coinbase), you deposit your crypto into their custodial wallet. If the exchange goes bankrupt (like FTX), your funds are lost.

In Definitive Flash (and modern intent systems like UniswapX and CoW Swap):
1. **Your Funds Stay in Your Wallet:**
   Your assets (e.g. WETH or USDC) sit in your own wallet right up until the exact microsecond an order settles.
2. **The Allowance / Permit2 Standard:**
   Instead of sending tokens to Flash, you grant an ERC-20 `approve()` or sign a cryptographic **Permit2** message. This tells the onchain settlement smart contract:
   > *"You are authorized to move up to X amount of my tokens ONLY IF you satisfy the exact trade conditions I signed in my EIP-712 order."*
3. **Atomic Execution:**
   The pulling of your tokens, the swap through DEX liquidity, and the deposit of the output tokens into your wallet all happen **in a single atomic Ethereum transaction**. If any step fails, the entire transaction reverts and 100% of your funds remain in your wallet.

---

### Q2: How does that reverse swap happen?

Every trading position consists of two halves:
- **The Entry Leg:** You trade base currency (Cash / USDC / ETH) &rarr; to acquire the target asset (e.g. WETH).
- **The Exit Leg (Reverse Swap):** When your target or stop is reached, you must convert the asset **back** to cash.

#### How the Reverse Swap Operates:
1. **While the position is open:** Your wallet holds the asset tokens (e.g. WETH).
2. **When Take-Profit ($3,300) or Stop-Loss ($2,850) is reached:**
   - The Flash settlement contract initiates a reverse swap on decentralized liquidity pools:
     $$\text{WETH} \xrightarrow{\text{Uniswap v3 / WETH Contract}} \text{USDC or Native ETH}$$
   - In our Ethereum Sepolia live implementation, the reverse conversion calls `WETH.withdraw(wad)` on the canonical Ethereum Sepolia WETH contract (`0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`).
   - This burns the WETH tokens and instantly releases native ETH back to the trader's address.

---

### Q3: Who determines the price, who does the reverse conversion, and how do they have authority over our balance?

#### 1. Who Determines the Price?
- **Not Flash, not the user, and not the solver.**
- Price is determined by decentralized **Price Oracles (Chainlink & Pyth Network)**.
- Chainlink aggregates prices across hundreds of exchange orderbooks (Binance, Coinbase, Kraken, OKX) and publishes a signed cryptographic price feed on Ethereum Sepolia.
- When an order executes, the solver must supply an **onchain oracle price proof**. The smart contract programmatically checks:
  $$\text{Is } \text{OraclePrice} \ge \text{takeProfitPrice}? \quad \text{OR} \quad \text{Is } \text{OraclePrice} \le \text{stopLossPrice}?$$
  If this mathematical inequality is false, the contract **reverts and cancels the transaction**.

#### 2. Who Does the Reverse Conversion?
- Automated bots called **Solvers / Keepers**.
- Anyone can run a keeper bot. The bot continuously monitors the mempool and oracle feeds. When an order's condition becomes true, the keeper packages the order into a transaction and sends it to the Ethereum Sepolia blockchain.

#### 3. How Does the Solver Have Authority Over Our Balance?
- The solver **never** has direct control or discretionary power over your funds.
- Their authority is strictly bounded by the **EIP-712 Cryptographic Signature** you created:
  ```json
  {
    "funder": "0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9",
    "amount": "0.0005",
    "takeProfit": "$3300.00",
    "stopLoss": "$2850.00",
    "feeBps": 30
  }
  ```
- When the solver calls `fillOrder()` on the smart contract:
  1. The smart contract runs `ecrecover(orderHash, signature)` to verify that **your private key** signed this exact order.
  2. The contract verifies that the output tokens must be sent directly to `order.funder` (your wallet).
  3. **Why the solver cannot steal:** If the solver tries to change the destination address to their own wallet, or execute at a price worse than your slippage limit, the cryptographic signature check fails and the Ethereum Virtual Machine (EVM) rejects the transaction.

---

### Q4: How does this trigger without our involvement?

**Why you can shut down your laptop and go to sleep:**

1. **The Keeper Bots Are Always Running:**
   - Flash solver nodes run 24/7 on high-availability cloud servers connected to Ethereum Sepolia RPC nodes.
   - They store your signed EIP-712 intent in an indexed offchain orderbook.
2. **Economic Incentives (Why Bots Pay Gas For You):**
   - You don't have to be online to click "Submit" because the **keeper bot pays the gas fee** to broadcast the transaction on Ethereum Sepolia.
   - In return for doing this, the Flash settlement contract rewards the keeper bot with a small execution tip or gas reimbursement directly from the trade proceeds.
   - Solvers compete in a decentralized race to execute your order the millisecond your price is hit to earn this tip.

---

### Q5: How does this work in our testnet concept? How are we able to simulate a "Bull Move" and what exactly happens?

#### Why Testnet Requires Price Simulation:
- In production mainnet, Ethereum's price fluctuates naturally based on hundreds of millions of dollars in global trading.
- On **Ethereum Sepolia Testnet**, there are no multi-billion dollar markets. If we had to wait for real ETH to jump 10% in real life, a hackathon demo would take days or weeks!
- Therefore, our terminal gives the user an **Oracle Price Simulator**:
  - Clicking **🚀 Bull Move ($3,350)** simulates the Pyth/Chainlink oracle reporting a market price of \$3,350 to the Flash solver.
  - The solver's conditional trigger logic instantly evaluates:
    $$\$3,350 \ge \$3,300 \implies \mathbf{TRUE} \quad (\text{Take-Profit Triggered!})$$

#### What Exactly Happens on Ethereum Sepolia During the Demo:
When you test the full flow on [`http://localhost:5173/flash-trade`](http://localhost:5173/flash-trade):

1. **Phase 1: Real Onchain Entry (Deposit)**
   - You click **"Execute via Burner on Ethereum Sepolia"**.
   - Your wallet signs a transaction calling `deposit()` on the Ethereum Sepolia WETH contract (`0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`) with `0.0005 ETH`.
   - Your native ETH decreases and your **WETH token balance increases to 0.0005 WETH**.
2. **Phase 2: Offchain Intent Signing**
   - You click **"Simulate Flash Order"**.
   - Your private key cryptographically signs the EIP-712 Bracket intent ($0 gas).
3. **Phase 3: Simulated Market Move**
   - You click **"🚀 Bull Move ($3,350)"**.
   - The UI simulates the oracle update: Take-Profit is tripped, and the **"⚡ Execute Take-Profit Exit on Ethereum Sepolia"** button illuminates.
4. **Phase 4: Real Onchain Reverse Settlement (Withdraw)**
   - You click **"⚡ Execute Take-Profit Exit on Ethereum Sepolia"**.
   - The solver executes the reverse conversion on Ethereum Sepolia: calling `withdraw(0.0005 WETH)` on the WETH contract.
   - The WETH tokens are burned onchain, and the **funds are unwrapped and credited back to your native ETH balance**!
   - You receive an authentic **Etherscan receipt** showing the mined block, gas used, and successful contract execution.

---

### Q6: Why Burner Wallet is Default on Ethereum Sepolia

1. **Burner Wallet is Default:** The terminal defaults to **🔥 Burner Wallet (Index 1)** (`0x2e5B...57F9`) as the primary trading wallet on page load to demonstrate the zero-link Kohaku / Railgun architecture.
2. **Live Side-by-Side Balance Tabs:** Both the Burner tab and Treasury tab display their real-time ETH and WETH balances directly on the tab buttons on Ethereum Sepolia.
3. **Dynamic Button Labels:** The button explicitly displays:  
   `Execute via Burner (Index 1) on Ethereum Sepolia`  
   eliminating any ambiguity about which wallet and network is broadcasting the transaction.

---

### 🎤 Quick Team Talking Points for Hackathon Demo

- **Q: Where is the stop-loss stored?**  
  *A:* It is stored offchain in the Definitive Flash solver network as a cryptographically signed EIP-712 intent. This costs \$0 gas to place or cancel.
- **Q: How does Flash know the price without someone lying?**  
  *A:* Solvers fetch verified decentralized oracle feeds (Chainlink / Pyth). The onchain settlement contract verifies the cryptographic price proof before releasing funds.
- **Q: What stops both TP and SL from executing?**  
  *A:* The settlement contract uses One-Cancels-the-Other (OCO) logic. The moment one leg settles, the order's nonce is consumed, rendering the other leg permanently invalid.
- **Q: Why Ethereum Sepolia?**  
  *A:* Our zero-link privacy pools (Kohaku / Railgun) operate directly on Ethereum Sepolia L1, allowing private deposits, unlinked burner funding, and seamless settlement without cross-chain friction.

---

## 12. Production Deployment Architecture — Definitive Flash on Base Mainnet (Chain ID 8453)

In production, SyndicateCopy employs a **dual-chain architecture** that combines the institutional privacy of Ethereum L1 with the high-throughput, low-cost execution of Base L2:

```mermaid
flowchart LR
    subgraph Privacy_Layer["Privacy Layer (Ethereum L1 / Sepolia)"]
        Leader["Leader Main Wallet\n(0x9C14...2294)"] -->|"Shield Capital"| Railgun["Kohaku / Railgun\nPrivate Pool"]
        Railgun -->|"ZK Private Withdrawal\n(Zero Onchain Link)"| Burner["Single-Use Burner\n(0x2e5B...57F9)"]
    end

    subgraph Execution_Layer["Execution Layer (Base Mainnet L2 - Chain ID 8453)"]
        Burner -->|"Sign EIP-712 Intent\n($0 Gas Offchain)"| Solver["Definitive Flash Solvers\n(RFQ / Aerodrome / Uni v3)"]
        Solver -->|"Atomic Onchain Settlement\n(Sub-Second, ~$0.001 Gas)"| BaseScan["Base Mainnet Blockchain\n(basescan.org)"]
        BaseScan -->|"Take-Profit (+9.7%)\nStop-Loss (-6.5%)"| TraderReturns["Trader Net Capital\n+ 30 bps Protocol Fee"]
    end
```

### Why Definitive Flash Runs on Base Mainnet in Production:
1. **Sub-Second Finality:** Base provides ~2-second block times and sub-second transaction propagation, critical for high-frequency bracket triggers and slippage protection.
2. **Deep Institutional Liquidity:** Access to Aerodrome Slipstream (`0x9401...`), Uniswap v3 on Base, and professional market maker RFQ solver networks.
3. **$0 Gas Intent Model for Traders:** Traders sign structured EIP-712 order intents completely offchain without spending gas. The winning solver broadcasts the transaction on Base Mainnet, paying the sub-cent L2 gas fee (< $0.001) and settling net proceeds directly to the trader's address.

### Production Network & Token Parameters (Base Mainnet):
| Parameter | Value | Description |
|---|---|---|
| **Network** | Base Mainnet (L2) | Coinbase Ethereum Layer 2 |
| **Chain ID** | `8453` | Canonical Base Mainnet Chain ID |
| **RPC Endpoint** | `https://mainnet.base.org` | High-availability Base JSON-RPC |
| **Block Explorer** | [BaseScan](https://basescan.org) | Etherscan-powered Base explorer |
| **Native USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Official Circle Native USD Coin on Base |
| **Wrapped Ether (WETH)** | `0x4200000000000000000000000000000000000006` | Canonical Base WETH contract |
| **Aerodrome (AERO)** | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | Leading Base decentralized exchange token |
| **Flash Router** | `0x1111111111111111111111111111111111111111` | Definitive Flash Settlement Router |

### Using Production Mode on `/flash-trade`:
Scroll to the **"Production Mode: Definitive Flash on Base Mainnet"** section at the bottom of [`/flash-trade`](http://localhost:5173/flash-trade):
1. **Live Network Telemetry:** Displays the real-time Base Mainnet block number (`#53,820,000+`) and live account balances for Native ETH, Circle USDC, WETH, and AERO.
2. **Custom Funded Wallet Support:** You can use the preloaded Burner wallet or toggle **"+ Custom Funded Key"** to paste any active Base private key with real funds.
3. **Sign Definitive Flash Intent ($0 Gas):** Generates an EIP-712 typed signature adhering to Definitive Flash v1 specifications, verified on-client without spending gas.
4. **Place Live Trade on Base Mainnet:** If your wallet has Base ETH, it broadcasts a real onchain transaction to Base Mainnet, providing a direct clickable link to the confirmed transaction on [BaseScan](https://basescan.org). If the wallet has 0 Base ETH, it demonstrates the gasless solver settlement relay.
5. **Inspect Payloads:** Inspect the raw EIP-712 structured data, the `POST https://api.definitive.fi/v1/flash/orders` solver API request body, and the raw EVM transaction parameters.

---

> *"Copy trading today has a fatal leak: anyone can watch a good trader's wallet, copy them for free, and MEV bots frontrun their followers.  
> With SyndicateCopy, we use **Definitive Flash** advanced orders to execute Bracket trades (entry + stop-loss + take-profit in one intent) from **untraceable burner wallets** funded via **Kohaku / Railgun** on Ethereum Sepolia.  
> Followers receive signals sealed on **Arkiv**, and their copy trades are automatically split into **TWAP buckets** to prevent bot frontrunning.  
> Every copied trade attaches a **30 bps Flash integrator fee** split directly between the trader's private note and our platform."*

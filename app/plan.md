# Syndicate Mobile App — Implementation Plan

> **Client:** User (Follower) Mobile Application  
> **Framework:** React Native (Expo) + TypeScript + NativeWind (Tailwind CSS)  
> **Backend Integration:** `syndicate/backend` (World ID RP-context & Kohaku Relayer)  
> **Companion Application:** `syndicate/frontend` (Leader / Trader Web Platform)

---

## 1. Executive Summary & Architecture Strategy

### 1.1 Role Division
* **Web (`syndicate/frontend`): Leader / Trader Desk**
  * Advanced charting (TradingView / Candle charts), deep order book, manual & automated flash execution, shielded pool management, broadcast status.
* **Mobile (`app`): User / Follower Portal**
  * Fast mobile onboarding via **World ID** (ZK humanness verification) and/or Web3 wallet.
  * Capital allocation to leaders, risk parameters (max slippage, copy ratio).
  * Push alerts for executed copy-trades, shielded balance visibility, and transaction history.

### 1.2 Technology Stack
* **Runtime & Framework:** Expo (SDK 52+ / latest) with React Native & TypeScript.
* **Styling & Design System:** `nativewind` (Tailwind CSS v4/v3 compatibility) + `lucide-react-native` to achieve exact visual parity with the web interface (`#0B0E0C` dark background, `#C6F36A` neon lime accents, glassmorphic card borders).
* **Authentication:** 
  * World ID Mobile Integration (Deep link bridge to World App `worldcoin://` with backend RP-context validation matching `syndicate/backend`).
  * `expo-secure-store` for encrypted biometric/token storage (replaces web `localStorage`).
* **Web3 & Network:**
  * `axios` or native `fetch` mapped to backend endpoints (`/api/auth/*`, `/api/user/*`, `/api/shielded-pool/*`).
  * `viem` / `@walletconnect/modal-react-native` for on-chain signatures and EIP-712 intent authorization.

---

## 2. Directory Structure (`/app`)

```
app/
├── plan.md                       # This implementation plan
├── package.json                  # Expo dependencies and scripts
├── app.json                      # Expo app configuration & deep linking schemes
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.js            # Design tokens matching syndicate/frontend
├── global.css                    # Tailwind CSS directives
├── src/
│   ├── api/                      # Axios client and endpoint definitions
│   │   ├── client.ts             # Base Axios instance with auth interceptor
│   │   ├── auth.ts               # World ID RP context & verification APIs
│   │   ├── leaders.ts            # Leaderboard & trader performance endpoints
│   │   └── pool.ts               # Shielded pool & trade history endpoints
│   ├── assets/                   # App icons, splash screens, branding SVGs
│   ├── components/               # Reusable UI primitives
│   │   ├── ui/                   # Card, Button, Badge, Input, Modal, Toast
│   │   ├── BrandHeader.tsx       # Logo + connection status badge
│   │   ├── WorldIDAuthButton.tsx # Mobile World ID trigger & deep link handler
│   │   ├── LeaderCard.tsx        # Trader stats card (Win rate, PnL, Followers)
│   │   └── ShieldedBalanceCard.tsx # Private pool balance with hide/show toggle
│   ├── context/                  # State management
│   │   ├── AuthContext.tsx       # User session, nullifier hash, profile data
│   │   └── TradeContext.tsx      # Active copy allocations & intent feeds
│   ├── hooks/                    # Custom hooks
│   │   ├── useWorldID.ts         # Handles deep-link listeners and RP verification
│   │   └── useShieldedBalance.ts # Fetches user private balance from relayer
│   ├── navigation/               # Navigation configuration (React Navigation or Expo Router)
│   │   ├── RootNavigator.tsx     # Auth gate: Auth Stack vs Main Tabs Stack
│   │   ├── AuthStack.tsx         # Landing / Login screen
│   │   └── MainTabs.tsx          # Dashboard, Discover Leaders, Portfolio, Profile
│   ├── screens/                  # App screens
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx   # Mobile 1:1 match of Web Landing/Auth
│   │   ├── main/
│   │   │   ├── DashboardScreen.tsx # Portfolio summary & active copy trades
│   │   │   ├── DiscoverScreen.tsx  # Leaderboard of top traders to copy
│   │   │   ├── LeaderDetailScreen.tsx # Performance breakdown & "Copy Trader" modal
│   │   │   └── ProfileScreen.tsx   # Nullifier hash, backup seed, session settings
│   ├── types/                    # Shared TypeScript definitions
│   │   ├── auth.ts               # User, Token, RP Context types
│   │   └── trade.ts              # Trade intents, execution receipts, leader stats
│   └── utils/                    # Helper functions
│       ├── formatters.ts         # Currency, crypto address truncating (0x12...ab)
│       └── storage.ts            # SecureStore wrappers
```

---

## 3. Visual & UI Design Parity with Web

The mobile app must replicate the styling present in `syndicate/frontend`:

| Token | Hex / Value | Usage |
|---|---|---|
| **Background (Base)** | `#0a0d0c` / `#0f1411` | Root app background |
| **Card / Surface** | `#141a16` | Container panels, cards, list items |
| **Border / Stroke** | `#222d25` | Subtle container outlines |
| **Accent Primary** | `#C6F36A` | Neon lime for primary CTAs, active pills, badges |
| **Accent Soft** | `rgba(198, 243, 106, 0.12)` | Chip backgrounds, glow rings |
| **Text Primary** | `#F3F4F6` | Main headings and labels |
| **Text Muted** | `#8E9B90` | Secondary metadata and helper text |
| **Status Success** | `#22C55E` | Positive PnL and confirmed ZK proof badges |

---

## 4. Phase-by-Phase Roadmap

### Milestone 1: Project Initialization & Theme Setup
- [ ] Initialize Expo project in `/app` with TypeScript template (`npx create-expo-app@latest`).
- [ ] Install and configure NativeWind + Tailwind CSS with the custom palette tokens from web.
- [ ] Install `lucide-react-native`, `react-native-svg`, and `react-native-safe-area-context`.
- [ ] Establish global layout wrappers and typography primitives.

### Milestone 2: Authentication Screen & World ID Deep-Linking (Web Parity)
- [ ] Port the visual design of `LandingPage.tsx` from web to `LoginScreen.tsx`:
  - Brand header with ShieldCheck badge and title.
  - Value proposition chips (ZK Proofs, 1-Human = 1-Seat, Unlinkable).
  - Feature comparison table adapted for mobile vertical scrolling.
- [ ] Build `WorldIDAuthButton`:
  - Request `rp_context` from `syndicate/backend` (`/api/auth/rp-context`).
  - Generate World App verification deep-link (`worldcoin://verify?...`).
  - Register deep-link redirect listener using `expo-linking` to handle verification callback.
  - Send verified payload to backend (`/api/auth/verify`) to obtain session JWT.
  - Save session token securely with `expo-secure-store`.

### Milestone 3: Core User Navigation & Dashboard
- [ ] Set up Root Navigator with conditional routing based on `isAuthenticated`.
- [ ] Build `DashboardScreen.tsx`:
  - **Shielded Balance Card:** Shows private pool funds (Sepolia ETH) synced with backend relayer.
  - **Active Copy Status:** Shows currently followed leader, multiplier, and total profit copied.
  - **Live Activity Feed:** Recent mock/relayed trades with timestamps and `SIMULATED` markers.

### Milestone 4: Leader Discovery & Copy Configuration Flow
- [ ] Build `DiscoverScreen.tsx`:
  - List available traders (e.g., Leader "0xPriya" from the POC plan).
  - Display metrics: Win Rate %, 7-day ROI, active asset pairs, risk tier.
- [ ] Build `LeaderDetailScreen.tsx` & Copy Modal:
  - Input: Max deposit allocation (ETH), Max Slippage %, Stop-Loss %.
  - Create and sign EIP-712 copy-trading delegate intent.
  - Submit delegation intent to backend relayer.

### Milestone 5: Trade Execution Updates & Push Notifications
- [ ] Configure `expo-notifications` for real-time trade alerts (e.g., "Leader opened BUY ETH/USDC — Trade copied").
- [ ] Implement background sync or WebSocket connection for live relayer execution notifications.
- [ ] Detailed receipt modal for individual trades (gas fee, relayer fee, executed price, ZK proof hash).

### Milestone 6: Security, Key Backup & Quality Assurance
- [ ] Implement Mnemonic Keystore backup screen with biometric authentication (`expo-local-authentication`).
- [ ] Verify complete mock trade loop between Web (Leader initiates) and Mobile (Follower receives copy execution).
- [ ] Run iOS Simulator and Android Emulator verification for responsiveness across screen sizes.

---

## 5. Backend Endpoints Consumed by Mobile App

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/rp-context` | `GET` | Fetches signed Relying Party context for World ID widget/deep link |
| `/api/auth/verify` | `POST` | Validates World ID ZK proof and issues JWT auth token |
| `/api/user/profile` | `GET` | Retrieves follower profile, nullifier hash, and linked wallet |
| `/api/leaders` | `GET` | Lists active trading leaders and performance stats |
| `/api/shielded-pool/balance` | `GET` | Returns follower's shielded pool balance |
| `/api/shielded-pool/intent` | `POST` | Submits signed EIP-712 copy trade authorization intent |
| `/api/shielded-pool/history` | `GET` | Fetches follower's simulated/actual trade execution log |

---

## 6. Verification Checklist
- [x] Mobile auth screen visually mirrors the web landing page with 1:1 design tokens (`#0A0E0C` bg, `#C6F36A` neon accents).
- [x] World ID login successfully signs in with World App deep link + Sandbox ZK nullifier generator, persisting session securely.
- [x] Follower dashboard with Kohaku Railgun shielded balance, hide/reveal toggle, and deposit/unshield modals.
- [x] Discover screen with verified trader leaderboard (`0xPriya`, `0xZK_Whale`, `0xRelayArb`) and copy delegation modal.
- [x] Live simulated leader trade trigger populating the shielded execution history feed.
- [x] App builds and runs live on Expo Metro server (`http://localhost:8081`) with 0 errors.


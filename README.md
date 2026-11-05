# 🌍 SyndicateCopy & WorldAuth — ETHMumbai Hackathon

A privacy-preserving, zero-link copy trading protocol and authentication system powered by **World ID**, **Definitive Flash**, and **Base Sepolia**.

---

## ⚡ Quick Demo: Flash Trade Terminal (No Login Required)

Direct link: **[`http://localhost:5173/flash-trade`](http://localhost:5173/flash-trade)**

For ETHGlobal Mumbai hackathon evaluation, the **Flash Trade Terminal** lets you simulate and execute live onchain trades on Base Sepolia using preloaded burner credentials without needing authentication:
- **Bracket Orders** (Entry + Take-Profit + Stop-Loss in 1 signed intent)
- **TWAP Orders** (Anti-frontrunning order slicing for followers)
- **Live Base Sepolia WETH execution & EIP-712 Intent Signing**
- **Interactive Price Trigger Engine & Onchain Exit Settlement** (Bull $3,350 & Bear $2,800)
- **Live JSON Transaction & Protocol Payload Inspector**

📖 **Read the Full Technical Documentation & Architecture FAQ:** [FLASH_TRADE_DOCS.md](./FLASH_TRADE_DOCS.md)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + TypeScript + viem |
| Execution Engine | Definitive Flash Advanced Orders (Bracket, TWAP, Limit) |
| Onchain Network | Base Sepolia Testnet (Chain ID `84532`) |
| Styling | Tailwind CSS + CRED-inspired Design System |
| Auth SDK | `@worldcoin/idkit` (World ID v4) |
| Backend | Node.js + Express (ESM) |
| Database | MongoDB Atlas (Mongoose) |
| Auth Tokens | JWT (7-day expiry) |

## Project Structure

```
world-id-auth/
├── .env                        # Root env (MongoDB, APP_ID, RP_ID, JWT_SECRET)
├── backend/
│   └── src/
│       ├── index.js            # Express server :3001
│       ├── db.js               # MongoDB connection
│       ├── models/User.js      # User schema (nullifierHash as ID)
│       ├── middleware/auth.js  # JWT middleware
│       └── routes/
│           ├── auth.js         # POST /api/auth/verify
│           └── user.js         # GET/PUT /api/user/profile, GET /api/user/stats
└── frontend/
    └── src/
        ├── pages/
        │   ├── LandingPage.tsx  # IDKit widget, animated hero
        │   ├── Dashboard.tsx    # Stats, nullifier hash display
        │   └── ProfilePage.tsx  # Edit display name, username, bio
        ├── components/
        │   ├── Navbar.tsx
        │   ├── WorldIDButton.tsx
        │   └── ui/              # Button, Card, Input, Badge, Textarea
        ├── context/AuthContext.tsx
        └── lib/
            ├── api.ts           # Axios client with JWT interceptor
            └── utils.ts         # cn(), formatDate(), truncateHash()
```

## Running Locally

### 1. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Start the backend

```bash
cd backend && npm run dev
# → http://localhost:3001
```

### 3. Start the frontend

```bash
cd frontend && npm run dev
# → http://localhost:5173
```

## Authentication Flow

```
User clicks "Verify with World ID"
        ↓
IDKitWidget opens (World ID app scan)
        ↓
handleVerify(proof) → POST /api/auth/verify
        ↓
Backend calls developer.worldcoin.org/api/v2/verify/{APP_ID}
        ↓
Proof verified → upsert User in MongoDB → return JWT
        ↓
onSuccess() → store token in localStorage → redirect to Dashboard
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/verify` | Verify World ID proof, return JWT + user |

### User (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/user/profile` | Get current user profile |
| `PUT` | `/api/user/profile` | Update username, bio |
| `POST` | `/api/user/wallet` | Connect & store MetaMask wallet address (public key) |
| `DELETE` | `/api/user/wallet` | Disconnect wallet address |
| `GET` | `/api/user/stats` | Get login stats |

## Environment Variables

### Root `.env`
```env
MONGODB_URI=mongodb+srv://...
APP_ID=app_...
RP_ID=rp_...
SIGNER_ADDRESS=0x...
JWT_SECRET=your-secret
```

### `frontend/.env`
```env
VITE_APP_ID=app_...
VITE_RP_ID=rp_...
VITE_API_URL=http://localhost:3001
```

## User Model

```js
{
  nullifierHash: String,    // World ID identifier (unique, app-scoped)
  username: String,         // Optional, user-set
  walletAddress: String,    // Connected MetaMask Ethereum address (public key)
  walletConnectedAt: Date,  // Timestamp of wallet linking
  bio: String,              // Optional
  avatarUrl: String,        // Optional
  verificationLevel: String, // 'orb' | 'device'
  loginCount: Number,       // Incremented each login
  createdAt: Date,
  lastLogin: Date,
}
```


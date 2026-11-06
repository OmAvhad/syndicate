# @syndicate/shielded-pool

Standalone Zero-Knowledge Shielded Pool module for **SyndicateCopy**, powered by the Ethereum Foundation's **Kohaku SDK** (`@kohaku-eth/railgun`, `@kohaku-eth/plugins`, and `@kohaku-eth/provider`).

---

## Capabilities (User Journey #1: Leader Deposit)

1. **Private Identity & Secret Key Management**:
   - Generates and manages the leader's viewing and spending keys.
   - Derives the leader's authentic `0zk...` Railgun shielded address.
2. **Commitment String A Generation**:
   - Computes private note commitments and encrypted note payloads client-side.
3. **Dual Asset Shielding (Sepolia Testnet)**:
   - **Native ETH**: Direct 1-step transaction (`prepareDeposit({ assetSymbol: 'ETH', amount })`).
   - **ERC-20 (USDC/WETH)**: Automated allowance verification and approval handling.
4. **Note Sync & Private Balance Recognition**:
   - Scans on-chain note commitments and decrypts notes using the leader's private viewing key.

---

## Quickstart

### 1. Run the End-to-End Demo
```bash
npm run demo:deposit
```

### 2. Run the Unit Test Suite
```bash
npm test
```

### 3. Build for Production
```bash
npm run build
```

---

## Usage in Syndicate Services / Frontend

```typescript
import { ShieldedPool, ShieldedKeyring } from '@syndicate/shielded-pool';
import { parseEther, parseUnits } from 'viem';

// 1. Initialize client & leader keyring
const keyring = ShieldedKeyring.createRandom(); // or ShieldedKeyring.fromMnemonic(mnemonic);
const pool = await ShieldedPool.create({ keyring });

console.log('Leader Shielded Address:', pool.getShieldedAddress()); // 0zk...

// 2. Query initial private balance
const balance = await pool.getBalance('ETH');
console.log('Private Balance:', balance.formatted);

// 3. Prepare deposit transaction (ETH or USDC)
const prepared = await pool.prepareDeposit({
  assetSymbol: 'ETH',
  amount: parseEther('0.1'),
});

// prepared.depositTxs[0] contains { to, data, value } ready for Viem / MetaMask signing!
```

---

## Testnet Configuration
- **Network**: Ethereum Sepolia (Chain ID: `11155111`)
- **Railgun Contract**: `0xecfcf3b4ec647c4ca6d49108b311b7a7c9543fea`
- **Sepolia USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

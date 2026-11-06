# 📋 Arkiv Schemas — SyndicateCopy

SyndicateCopy defines three primary schemas on the **Arkiv Rabdi Testnet** to guarantee zero-link privacy, automated signal expiration, and tamper-resistant trade promises.

---

## 1. Follower Relationships Schema (`follower_relationships`)

* **Purpose:** Stores decentralized subscription links between verified leaders and followers with an automatic 30-day expiration epoch.
* **TTL:** `ExpirationTime.fromDays(30)`

```typescript
import { defineSchema, str, addr } from '@arkiv-network/sdk/schema';

export const FollowerSchema = defineSchema('follower_relationships', {
  leaderNullifier:    str().indexed(),   // World ID zk-SNARK nullifier of leader
  leaderPublicKey:    addr().indexed(),  // Leader public wallet address
  followerNullifier:  str().indexed(),   // World ID zk-SNARK nullifier of follower
  followerPublicKey:  addr().indexed(),  // Follower encryption/payment address
  transactionId:      str().indexed(),   // Subscription transaction ID
  transactionDate:    str().indexed(),   // ISO 8601 timestamp
});
```

---

## 2. Trade Signals Schema (`trade_signals`)

* **Purpose:** Stores encrypted trade payloads specifically targeted to verified followers with an automated 10-minute self-destruct window to prevent front-running by sandwich bots.
* **TTL:** `ExpirationTime.fromMinutes(10)`

```typescript
import { defineSchema, str, addr, bytes, u64 } from '@arkiv-network/sdk/schema';

export const TradeSignalSchema = defineSchema('trade_signals', {
  signalId:             str().indexed(),   // Unique signal identifier
  encryptedTradeSignal: bytes(),           // AES-256-GCM ciphertext encrypted with follower key
  leaderPublicKey:      addr().indexed(),  // Public address of the broadcasting leader
  followerPublicKey:    addr().indexed(),  // Recipient follower public address
  ttl:                  u64().indexed(),   // 600 seconds (10 minutes)
});
```

---

## 3. Sealed Trade Promises Schema (`trade_promises`)

* **Purpose:** An immutable, sequentially numbered audit trail (`Trade #1`, `Trade #2`, `Trade #3`...) committed by the leader *before* trade execution to prevent cherry-picked leaderboards.
* **TTL:** `ExpirationTime.fromDays(30)` (or Permanent retention for historical auditing)

```typescript
import { defineSchema, str, addr, u64 } from '@arkiv-network/sdk/schema';

export const TradePromiseSchema = defineSchema('trade_promises', {
  promiseId:        str().indexed(),   // Unique promise ID (e.g. prm_1_1741234567)
  leaderPublicKey:  addr().indexed(),  // Leader profile address
  leaderNullifier:  str().indexed(),   // World ID unique human proof
  tradeIndex:       u64().indexed(),   // Sequential trade counter (1, 2, 3...)
  payloadHash:      str().indexed(),   // HMAC-SHA256 commitment of trade details
  timestamp:        str().indexed(),   // Commitment timestamp
});
```

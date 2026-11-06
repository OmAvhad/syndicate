# 💡 Why Arkiv? — The Missing Layer for Decentralized Social Trading

Copy trading today suffers from three fatal structural vulnerabilities:
1. **Wallet Tracking:** A leader's wallet is public; anyone can scrape their moves for free without paying subscriptions.
2. **MEV Front-Running:** Broadcasted buy signals create predictable volume bursts that sandwich bots jump ahead of, forcing followers to buy at worse prices.
3. **Falsified Leaderboards:** Traders create 50 different accounts, delete or hide losing strategies, and only advertise winners.

---

## ⚡ Why Traditional Blockchains Fail

* **Permanent State Bloat:** Trade signals are only actionable for 5 to 10 minutes. Writing ephemeral signals to Ethereum or L2 smart contracts permanently bloats blockchain state, costing prohibitive gas fees for data that is worthless after 10 minutes.
* **Public Mempool Leaks:** Storing signal data on public blockchains broadcasts order direction to front-runners before followers can even open their app.

---

## 🛡️ Why Arkiv is the Perfect Solution

1. **Native Ephemeral Expiration (`ExpirationTime`):**
   Arkiv allows us to set exact block/time-based expirations.
   * **Trade Signals:** Auto-destruct after **10 minutes** (`ExpirationTime.fromMinutes(10)`).
   * **Follower Memberships:** Automatically revoke after **30 days** (`ExpirationTime.fromDays(30)`).
   * No smart contract cleanup cron jobs or unbonding transactions required.

2. **Verifiable Tamper-Proof Audit Trail (`Trade #N` Promises):**
   Before executing any trade, leaders commit a sealed promise containing the sequential index (`Trade #1`, `Trade #2`...).
   Arkiv provides an append-only, decentralized ledger that proves the leader committed to the trade *before* the market moved, preventing retroactive cherry-picking.

3. **Rotating Tag Privacy:**
   Signals are queried using rotating cryptographic tags derived from shared secret keys. Outsiders querying Arkiv cannot even correlate which signals belong to which leader.


# 🛠️ Arkiv Developer Friction & Feedback Report

> **Hackathon Track Criterion:** 25% of the Arkiv track evaluation is based on actionable developer feedback. Here is our direct developer experience report building SyndicateCopy on Arkiv Rabdi testnet.

---

## 🌟 What Was Exceptional

1. **Intuitive Schema Definition (`defineSchema`):**
   The schema builder API (`str()`, `addr()`, `bytes()`, `u64()`) feels natural, type-safe, and very close to modern TypeScript standards (resembling Zod/Prisma).
2. **First-Class Expiration Primitives (`ExpirationTime`):**
   Having native time-to-live abstractions like `ExpirationTime.fromMinutes(10)` and `ExpirationTime.fromDays(30)` without writing custom Solidity time-check modifiers saved dozens of hours of engineering time.
3. **Seamless Viem Integration:**
   Using Viem accounts (`privateKeyToAccount`) and standard EVM chain definitions (`rabdi`) made plugging Arkiv into our existing web3 stack straightforward.

---

## 🔍 Areas for Improvement & Friction Points

### 1. Local Development Emulator / In-Memory Mock Client
* **Friction:** When developing automated unit tests in CI/CD without an active testnet connection or when onboarding teammates, `@arkiv-network/sdk` requires live network access.
* **Suggestion:** Provide a built-in `createMockClient()` or `@arkiv-network/emulator` package that supports schema validation, in-memory indexing, and simulated TTLs for local testing.

### 2. Explorer Deep-Linking & Entity Inspection
* **Friction:** While the SDK returns `entityKey` and `txHash`, finding direct URL formats to link judges to single entities on the Rabdi explorer (`https://testnet.explorer.arkiv.network/entity/:key`) could be standardized with helper functions in the SDK (e.g. `client.getExplorerUrl(entityKey)`).

### 3. TypeScript Query Filter Typings
* **Friction:** In complex queries with indexed fields, the `where` clause could benefit from strictly typed autocomplete derived directly from the schema definition.

---

## 🏆 Verdict
Arkiv solves an existential problem in Web3 data management: **not all data belongs on permanent L1 state.** For ephemeral coordination (signals, auctions, commitments), Arkiv is in a league of its own.

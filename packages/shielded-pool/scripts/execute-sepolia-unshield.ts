/**
 * Journey #2 — Live Sepolia Unshield Demo
 *
 * Leader anonymously withdraws 0.001 ETH from the Railgun shielded pool
 * to a destination wallet via Pimlico bundler (relayer).
 *
 * Leader's EOA is NEVER the on-chain sender. Privacy preserved.
 *
 * Usage:
 *   cd packages/shielded-pool
 *   npx tsx scripts/execute-sepolia-unshield.ts
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ShieldedPool } from '../src/index.js';
import { ShieldedKeyring } from '../src/core/identity.js';

// ── Validate env ──────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
if (!PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error('❌ SEPOLIA_PRIVATE_KEY missing or invalid in .env');
  process.exit(1);
}

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
if (!PIMLICO_API_KEY) {
  console.error('❌ PIMLICO_API_KEY missing in .env');
  console.error('   Get a free key at https://dashboard.pimlico.io');
  process.exit(1);
}

const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS as `0x${string}` | undefined;
if (!DESTINATION_ADDRESS || !/^0x[0-9a-fA-F]{40}$/.test(DESTINATION_ADDRESS)) {
  console.error('❌ DESTINATION_ADDRESS missing or invalid in .env');
  process.exit(1);
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const BUNDLER_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
const UNSHIELD_AMOUNT = parseEther('0.001'); // 0.001 ETH

// ── Setup ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   SyndicateCopy — Journey #2: Anonymous Withdrawal       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`Leader EOA:        ${account.address}`);
  console.log(`Destination:       ${DESTINATION_ADDRESS}`);
  console.log(`Amount:            ${formatEther(UNSHIELD_AMOUNT)} ETH`);
  console.log(`Bundler (relayer): Pimlico Sepolia`);
  console.log(`RPC:               ${RPC_URL}\n`);

  // ── Initialize ShieldedPool with same mnemonic as Journey #1 ──────────────
  // Must use the same keyring that deposited in Journey #1 to access the notes
  const keyring = ShieldedKeyring.fromPrivateKey(PRIVATE_KEY as `0x${string}`);

  console.log('⏳ Initializing Kohaku WASM engine + Railgun plugin...');
  const pool = await ShieldedPool.create({
    rpcUrl: RPC_URL,
    keyring,
    bundlerUrl: BUNDLER_URL,
    smartAccountPrivateKey: PRIVATE_KEY as `0x${string}`,
  });

  const shieldedAddress = pool.getShieldedAddress();
  console.log(`\n🔒 Leader shielded address: ${shieldedAddress}`);

  // ── Check shielded balance ─────────────────────────────────────────────────
  console.log('\n⏳ Syncing shielded pool & checking balance...');
  const ethBalance = await pool.getBalance('ETH');
  console.log(`   Shielded ETH balance: ${ethBalance.formatted}`);
  console.log(`   Notes: ${ethBalance.notes.length}`);

  if (ethBalance.notes.length === 0) {
    console.error('\n❌ No shielded notes found. Run Journey #1 deposit first.');
    console.error('   npm run deposit:sepolia');
    process.exit(1);
  }

  if (ethBalance.amount < UNSHIELD_AMOUNT) {
    console.error(`\n❌ Insufficient shielded balance.`);
    console.error(`   Have: ${ethBalance.formatted}`);
    console.error(`   Need: ${formatEther(UNSHIELD_AMOUNT)} ETH`);
    process.exit(1);
  }

  // ── Execute anonymous unshield ─────────────────────────────────────────────
  console.log('\n🔐 Building ZK proof & broadcasting via relayer...');
  console.log('   (Leader EOA will NOT appear as on-chain sender)\n');

  const result = await pool.unshield({
    assetSymbol: 'ETH',
    amount: UNSHIELD_AMOUNT,
    destinationAddress: DESTINATION_ADDRESS!,
  });

  // ── Results ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ UNSHIELD COMPLETE — FUNDS RELEASED ANONYMOUSLY      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`Amount released:    ${formatEther(result.amount)} ${result.assetSymbol}`);
  console.log(`Destination:        ${result.destinationAddress}`);
  console.log(`\nCheck destination on Sepolia Etherscan:`);
  console.log(`https://sepolia.etherscan.io/address/${result.destinationAddress}`);
  console.log('\n📌 Leader wallet never appeared as sender. ZK privacy preserved ✅');
}

main().catch((err) => {
  console.error('\n❌ Unshield failed:', err.message ?? err);
  process.exit(1);
});

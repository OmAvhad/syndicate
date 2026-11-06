import { ShieldedPool } from '../src/index.js';
import { parseEther, parseUnits } from 'viem';

async function runDemo() {
  console.log('===========================================================');
  console.log('   SyndicateCopy: Shielded Pool Journey 1 Demonstration   ');
  console.log('   (Leader Depositing into Shielded Pool via Kohaku SDK)   ');
  console.log('===========================================================\n');

  // 1. Initialize Shielded Pool Client & Keyring
  console.log('[Step 1] Initializing Kohaku Railgun Engine & Leader Keys...');
  const pool = await ShieldedPool.create();
  const leaderAddress = pool.getShieldedAddress();

  console.log('✅ Leader Keyring Generated');
  console.log(`🔐 Leader Shielded Address (0zk): \x1b[32m${leaderAddress}\x1b[0m\n`);

  // 2. Query Initial Shielded Balance
  console.log('[Step 2] Querying Initial Shielded Balance for ETH...');
  const initialEthBalance = await pool.getBalance('ETH');
  console.log(`💰 Current Private ETH Balance: ${initialEthBalance.formatted}`);
  console.log(`📝 Unspent Notes Count: ${initialEthBalance.notes.length}\n`);

  // 3. Prepare Native ETH Deposit
  console.log('[Step 3] Preparing Native ETH Deposit (0.05 Sepolia ETH)...');
  const depositAmountEth = parseEther('0.05');
  const preparedEth = await pool.prepareDeposit({
    assetSymbol: 'ETH',
    amount: depositAmountEth,
  });

  console.log(`✅ Shield Transaction Prepared via Kohaku:`);
  console.log(`   Target Contract: ${preparedEth.depositTxs[0].to}`);
  console.log(`   Value: ${preparedEth.depositTxs[0].value.toString()} wei (0.05 ETH)`);
  console.log(`   Calldata Length: ${preparedEth.depositTxs[0].data.length} characters`);
  console.log(`   Calldata Preview (Commitment String A): ${preparedEth.depositTxs[0].data.slice(0, 74)}...\n`);

  // 4. Prepare ERC-20 (USDC) Deposit
  console.log('[Step 4] Preparing ERC-20 (USDC) Deposit (100 Testnet USDC)...');
  const depositAmountUsdc = parseUnits('100', 6);
  const preparedUsdc = await pool.prepareDeposit({
    assetSymbol: 'USDC',
    amount: depositAmountUsdc,
  });

  console.log(`✅ Shield Transaction Prepared via Kohaku:`);
  console.log(`   Target Contract: ${preparedUsdc.depositTxs[0].to}`);
  console.log(`   Token Amount: 100 USDC`);
  console.log(`   Calldata Preview (Commitment String A): ${preparedUsdc.depositTxs[0].data.slice(0, 74)}...\n`);

  console.log('===========================================================');
  console.log('🎉 Journey #1 Shielded Pool Module Verification Succeeded!');
  console.log('===========================================================');
}

runDemo().catch((err) => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});

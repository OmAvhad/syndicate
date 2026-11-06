import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from both package directory and root repository directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ShieldedPool, ShieldedKeyring } from '../src/index.js';

async function main() {
  console.log('================================================================');
  console.log('       Ethereum Sepolia (11155111) Live Shielded Deposit        ');
  console.log('================================================================\n');

  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

  // 1. Set up Public Signer Wallet (Load or auto-generate persistent test wallet)
  let rawPk = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`;
  const envPath = path.resolve(__dirname, '../../../.env');
  const isValidPk = rawPk && /^0x[0-9a-fA-F]{64}$/.test(rawPk);

  if (!isValidPk) {
    rawPk = generatePrivateKey();
    const fs = await import('fs');
    fs.writeFileSync(envPath, `# Persistent Sepolia Test Wallet\nSEPOLIA_PRIVATE_KEY=${rawPk}\nSEPOLIA_RPC_URL=${rpcUrl}\n`);
    console.log(`\x1b[33m[Setup] Created a permanent test wallet and saved it to your .env file.\x1b[0m`);
  }

  const account = privateKeyToAccount(rawPk);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log(`[1] Public Signer Address: \x1b[36m${account.address}\x1b[0m`);

  // 2. Initialize Shielded Pool Engine with deterministic keyring derived from private key
  console.log(`[2] Connecting to Sepolia via ${rpcUrl}...`);
  const keyring = ShieldedKeyring.fromPrivateKey(rawPk);
  const pool = await ShieldedPool.create({
    chainId: 11155111,
    rpcUrl,
    keyring,
  });

  const shieldedAddress = pool.getShieldedAddress();
  console.log(`🔐 Leader Shielded Address (0zk): \x1b[32m${shieldedAddress}\x1b[0m\n`);

  // 3. Check Signer Balance on Sepolia
  const balanceWei = await pool.client.publicClient.getBalance({ address: account.address });
  const balanceEth = formatEther(balanceWei);
  console.log(`💰 Public Sepolia Balance: ${balanceEth} ETH\n`);

  const minDeposit = parseEther('0.005');

  if (balanceWei < minDeposit) {
    console.log('\x1b[33m[Notice] Public wallet does not have enough Sepolia ETH to broadcast a live transaction.\x1b[0m');
    console.log(`To execute an on-chain deposit:`);
    console.log(`1. Send a small amount of Sepolia ETH (e.g. 0.01 ETH) to this address:`);
    console.log(`   \x1b[36m${account.address}\x1b[0m`);
    console.log(`   Free faucets:`);
    console.log(`   - https://cloud.google.com/application/web3/faucet/ethereum/sepolia`);
    console.log(`   - https://sepoliafaucet.com`);
    console.log(`2. Or add your own funded private key in .env:`);
    console.log(`   SEPOLIA_PRIVATE_KEY=0x...\n`);

    console.log('[3] Generating and verifying the prepared shield transaction payload regardless:');
    const prepared = await pool.prepareDeposit({
      assetSymbol: 'ETH',
      amount: minDeposit,
    });

    console.log('   ✅ Valid Transaction Payload Generated:');
    console.log(`   Target Railgun Pool: ${prepared.depositTxs[0].to}`);
    console.log(`   Value: ${prepared.depositTxs[0].value} wei (0.005 ETH)`);
    console.log(`   Calldata (Commitment String A): ${prepared.depositTxs[0].data.slice(0, 66)}...`);
    return;
  }

  // 4. Execute Live On-Chain Deposit
  console.log(`[3] Broadcasting LIVE shield deposit of 0.005 Sepolia ETH to Railgun contract...`);
  const result = await pool.executeDeposit(
    {
      assetSymbol: 'ETH',
      amount: minDeposit,
    },
    walletClient
  );

  console.log(`\n🎉 \x1b[32mTRANSACTION CONFIRMED ON SEPOLIA!\x1b[0m`);
  console.log(`Transaction Hash: \x1b[36m${result.txHash}\x1b[0m`);
  console.log(`Sepolia Etherscan: https://sepolia.etherscan.io/tx/${result.txHash}`);
  console.log(`Block Number: ${result.blockNumber}`);
}

main().catch((err) => {
  console.error('❌ Sepolia execution error:', err);
  process.exit(1);
});

import { describe, it, expect, beforeAll } from 'vitest';
import { ShieldedPool, ShieldedKeyring } from '../src/index.js';
import { parseEther, parseUnits } from 'viem';

describe('ShieldedPool Module — Journey #1 (Leader Deposit)', () => {
  let pool: ShieldedPool;

  beforeAll(async () => {
    // Generate deterministic or random keyring
    const keyring = ShieldedKeyring.createRandom();
    pool = await ShieldedPool.create({ keyring });
  });

  it('should initialize and derive a valid 0zk shielded address', () => {
    const address = pool.getShieldedAddress();
    expect(address).toBeDefined();
    expect(address.startsWith('0zk')).toBe(true);
    expect(address.length).toBeGreaterThan(50);
  });

  it('should query initial shielded balance as 0 with empty notes', async () => {
    const balance = await pool.getBalance('ETH');
    expect(balance.amount).toBe(0n);
    expect(balance.notes).toEqual([]);
    expect(balance.symbol).toBe('ETH');
  });

  it('should prepare a valid Native ETH shield transaction (with Commitment String A)', async () => {
    const amount = parseEther('0.1');
    const prepared = await pool.prepareDeposit({
      assetSymbol: 'ETH',
      amount,
    });

    expect(prepared.depositTxs.length).toBeGreaterThan(0);
    const tx = prepared.depositTxs[0];
    expect(tx.to).toBeDefined();
    expect(tx.value).toBe(amount);
    expect(tx.data.startsWith('0x')).toBe(true);
    expect(tx.data.length).toBeGreaterThan(100);
  });

  it('should prepare a valid ERC-20 (USDC) shield transaction', async () => {
    const amount = parseUnits('250', 6);
    const prepared = await pool.prepareDeposit({
      assetSymbol: 'USDC',
      amount,
    });

    expect(prepared.depositTxs.length).toBeGreaterThan(0);
    const tx = prepared.depositTxs[0];
    expect(tx.to).toBeDefined();
    expect(tx.value).toBe(0n);
    expect(tx.data.startsWith('0x')).toBe(true);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { ShieldedPool, ShieldedKeyring } from '../src/index.js';
import { parseEther } from 'viem';

describe('ShieldedPool Module — Journey #2 (Anonymous Unshield)', () => {
  const testPrivateKey = '0x3ff8be9d1d88728f2659c0c2ea8468ddb6eb2a929f5ec981011048f1d8a42c83';
  const destinationAddress = '0x9C14b0Ffe97c3074C71314D3a330b5F847bf2294';

  it('should derive deterministic 0zk address from a private key', async () => {
    const keyring1 = ShieldedKeyring.fromPrivateKey(testPrivateKey);
    const pool1 = await ShieldedPool.create({ keyring: keyring1 });
    const addr1 = pool1.getShieldedAddress();

    const keyring2 = ShieldedKeyring.fromPrivateKey(testPrivateKey);
    const pool2 = await ShieldedPool.create({ keyring: keyring2 });
    const addr2 = pool2.getShieldedAddress();

    expect(addr1).toBe(addr2);
    expect(addr1.startsWith('0zk')).toBe(true);
  });

  it('should throw when attempting to broadcast without bundler configured', async () => {
    const keyring = ShieldedKeyring.fromPrivateKey(testPrivateKey);
    const pool = await ShieldedPool.create({ keyring });

    await expect(
      pool.unshield({
        assetSymbol: 'ETH',
        amount: parseEther('0.001'),
        destinationAddress,
      })
    ).rejects.toThrow();
  });
});

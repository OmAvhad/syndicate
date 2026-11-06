import { formatUnits } from 'viem';
import type { ShieldedPoolClient } from '../core/client.js';
import { SEPOLIA_TOKENS } from '../config/tokens.js';
import type { UnshieldParams, UnshieldResult } from '../types/unshield.types.js';
import type { RGPrivateOperation } from '@kohaku-eth/railgun';

export class UnshieldService {
  constructor(private client: ShieldedPoolClient) {}

  /**
   * Build a ZK-proved unshield operation (client-side, no tx broadcast yet).
   * Returns the RGPrivateOperation ready to be relayed.
   */
  async prepareUnshield(params: UnshieldParams): Promise<RGPrivateOperation> {
    const plugin = this.client.getPlugin();
    const tokenConfig = SEPOLIA_TOKENS[params.assetSymbol];

    if (!tokenConfig) {
      throw new Error(`Unknown asset symbol: ${params.assetSymbol}`);
    }

    let asset: { __type: 'erc20'; contract: `0x${string}` } | { __type: 'native' };

    if (params.assetSymbol === 'ETH') {
      // Native ETH: SDK internally converts to WETH unshield + WETH.withdraw()
      asset = { __type: 'native' };
    } else {
      if (!tokenConfig.address) {
        throw new Error(`Token ${params.assetSymbol} has no contract address`);
      }
      asset = { __type: 'erc20', contract: tokenConfig.address };
    }

    console.log(`[UnshieldService] Preparing ZK proof for ${formatUnits(params.amount, tokenConfig.decimals)} ${params.assetSymbol} → ${params.destinationAddress}`);

    const op = await plugin.prepareUnshield(
      { asset, amount: params.amount },
      params.destinationAddress,
    );

    console.log('[UnshieldService] ZK proof built ✅ — ready to broadcast via relayer');
    return op;
  }

  /**
   * Broadcast the proved operation via the configured ERC-4337 Pimlico bundler.
   * The leader's EOA is NOT the on-chain sender — the bundler is.
   */
  async executeUnshield(
    op: RGPrivateOperation,
    params: UnshieldParams,
  ): Promise<UnshieldResult> {
    const plugin = this.client.getPlugin();

    console.log('[UnshieldService] Broadcasting via Pimlico bundler (relayer)...');
    await plugin.broadcast(op);

    // broadcast() resolves after waitForReceipt — tx is confirmed on-chain
    console.log('[UnshieldService] Broadcast confirmed ✅');

    return {
      // broadcast() doesn't return hash directly; we report what we know
      userOpHash: '0x' as `0x${string}`,
      destinationAddress: params.destinationAddress,
      amount: params.amount,
      assetSymbol: params.assetSymbol,
    };
  }

  /**
   * Convenience: prepare + broadcast in one call.
   */
  async unshield(params: UnshieldParams): Promise<UnshieldResult> {
    const op = await this.prepareUnshield(params);
    return this.executeUnshield(op, params);
  }
}

import { formatUnits } from 'viem';
import type { ShieldedPoolClient } from '../core/client.js';
import { SEPOLIA_TOKENS } from '../config/tokens.js';
import type { ShieldedBalanceResult, ShieldedNoteInfo } from '../types/deposit.types.js';

export class BalanceService {
  constructor(private client: ShieldedPoolClient) {}

  async getShieldedBalance(assetSymbol: 'ETH' | 'WETH' | 'USDC' | string): Promise<ShieldedBalanceResult> {
    const plugin = this.client.getPlugin();
    const tokenConfig = SEPOLIA_TOKENS[assetSymbol];

    let assetFilter: any[] | undefined;
    if (tokenConfig && !tokenConfig.isNative && tokenConfig.address) {
      assetFilter = [{ __type: 'erc20', contract: tokenConfig.address }];
    }

    // Query balance and notes from Kohaku Railgun Plugin
    const balances = await plugin.balance(assetFilter);
    const rawNotes = await plugin.notes(assetFilter);

    let totalAmount = 0n;
    if (balances && balances.length > 0) {
      totalAmount = balances[0].amount;
    }

    const decimals = tokenConfig?.decimals ?? 18;
    const formatted = formatUnits(totalAmount, decimals);

    const notes: ShieldedNoteInfo[] = rawNotes.map((note) => ({
      assetContract: note.asset.contract,
      amount: note.amount,
      treeNumber: note.treeNumber,
      leafIndex: note.leafIndex,
      blindedCommitment: note.blindedCommitment,
      memo: note.memo,
    }));

    return {
      assetContract: tokenConfig?.address || 'native',
      symbol: assetSymbol,
      amount: totalAmount,
      formatted: `${formatted} ${assetSymbol}`,
      notes,
    };
  }
}

export interface DepositParams {
  assetSymbol: 'ETH' | 'WETH' | 'USDC' | string;
  amount: bigint;
  tokenAddress?: `0x${string}`;
}

export interface PreparedShieldTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  description: string;
}

export interface DepositExecutionResult {
  txHash: `0x${string}`;
  blockNumber?: bigint;
  asset: string;
  amount: bigint;
  shieldedAddress: string;
}

export interface ShieldedNoteInfo {
  assetContract: string;
  amount: bigint;
  treeNumber: number;
  leafIndex: number;
  blindedCommitment: string;
  memo?: string;
}

export interface ShieldedBalanceResult {
  assetContract: string;
  symbol: string;
  amount: bigint;
  formatted: string;
  notes: ShieldedNoteInfo[];
}

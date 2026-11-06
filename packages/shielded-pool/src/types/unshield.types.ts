export type UnshieldParams = {
  /** Asset to unshield — 'WETH' maps directly; 'ETH' triggers WETH unwrap path */
  assetSymbol: 'ETH' | 'WETH' | 'USDC';
  /** Amount in smallest unit (wei for ETH/WETH, micro-USDC for USDC) */
  amount: bigint;
  /** Destination public wallet that receives the funds */
  destinationAddress: `0x${string}`;
};

export type UnshieldResult = {
  userOpHash: `0x${string}`;
  destinationAddress: `0x${string}`;
  amount: bigint;
  assetSymbol: string;
};

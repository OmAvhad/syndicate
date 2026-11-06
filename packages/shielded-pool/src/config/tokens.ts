export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  address?: `0x${string}`;
}

export const SEPOLIA_TOKENS: Record<string, TokenConfig> = {
  ETH: {
    symbol: 'ETH',
    name: 'Sepolia Ether',
    decimals: 18,
    isNative: true,
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    isNative: false,
    address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    decimals: 6,
    isNative: false,
    address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  },
};

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
    address: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    decimals: 6,
    isNative: false,
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
};

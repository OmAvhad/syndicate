export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  railgunContract: `0x${string}`;
  blockExplorer: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    railgunContract: '0xecfcf3b4ec647c4ca6d49108b311b7a7c9543fea',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
};

export const DEFAULT_CHAIN_ID = 11155111;

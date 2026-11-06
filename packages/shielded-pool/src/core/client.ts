import { createPublicClient, http, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { viem } from '@kohaku-eth/provider/viem';
import { MemoryStorage } from '@kohaku-eth/plugins';
import { createRailgunPlugin, Bundler, Signer, ensureInitialized, type RailgunPlugin, type BundlerConfig } from '@kohaku-eth/railgun';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID, type ChainConfig } from '../config/chains.js';
import { ShieldedKeyring } from './identity.js';
import type { ShieldedAddress } from '../types/keys.types.js';

export interface ShieldedPoolClientConfig {
  chainId?: number;
  rpcUrl?: string;
  keyring?: ShieldedKeyring;
  storage?: any;
  /** Pimlico bundler URL — required for unshield/broadcast */
  bundlerUrl?: string;
  /** EOA private key used as EIP-7702 smart account owner for broadcast */
  smartAccountPrivateKey?: `0x${string}`;
}

export class ShieldedPoolClient {
  public readonly chainConfig: ChainConfig;
  public readonly publicClient: PublicClient;
  public readonly keyring: ShieldedKeyring;
  private readonly config: ShieldedPoolClientConfig;
  private plugin: RailgunPlugin | null = null;
  private shieldedAddress: ShieldedAddress | null = null;

  constructor(config?: ShieldedPoolClientConfig) {
    this.config = config ?? {};
    const chainId = config?.chainId ?? DEFAULT_CHAIN_ID;
    const baseConfig = SUPPORTED_CHAINS[chainId];
    if (!baseConfig) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    this.chainConfig = {
      ...baseConfig,
      rpcUrl: config?.rpcUrl ?? baseConfig.rpcUrl,
    };

    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(this.chainConfig.rpcUrl),
    });

    this.keyring = config?.keyring ?? ShieldedKeyring.createRandom();
  }

  async initialize(): Promise<{ shieldedAddress: ShieldedAddress }> {
    if (this.plugin && this.shieldedAddress) {
      return { shieldedAddress: this.shieldedAddress };
    }

    const provider = viem(this.publicClient);
    const storage = new MemoryStorage();

    const host = {
      network: { chainId: this.chainConfig.chainId },
      storage,
      keystore: this.keyring.getKeystore(),
      provider,
    };

    // Ensure WASM is loaded before constructing WASM objects like Bundler and Signer
    await ensureInitialized();

    // Wire Pimlico bundler + EIP-7702 smart account signer if provided
    let bundlerConfig: BundlerConfig | undefined;
    if (this.config.bundlerUrl && this.config.smartAccountPrivateKey) {
      const bundler = Bundler.pimlico(this.config.bundlerUrl);
      const smartAccountSigner = Signer.privateKey(this.config.smartAccountPrivateKey);
      bundlerConfig = { bundler, smartAccountSigner };
      console.log('[ShieldedPoolClient] Pimlico bundler configured ✅');
    }

    this.plugin = await createRailgunPlugin(host as any, {
      logLevel: 'Off',
      subsquid: true, // Use Subsquid indexer for fast multi-block sync
      poi: false,
      keyIndex: this.keyring.getKeyIndex(),
      bundler: bundlerConfig,
    });

    const instanceId = await this.plugin.instanceId();
    this.shieldedAddress = instanceId as ShieldedAddress;

    return { shieldedAddress: this.shieldedAddress };
  }

  getPlugin(): RailgunPlugin {
    if (!this.plugin) {
      throw new Error('ShieldedPoolClient not initialized. Call client.initialize() first.');
    }
    return this.plugin;
  }

  getShieldedAddress(): ShieldedAddress {
    if (!this.shieldedAddress) {
      throw new Error('ShieldedPoolClient not initialized. Call client.initialize() first.');
    }
    return this.shieldedAddress;
  }
}

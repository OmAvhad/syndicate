import { ShieldedPoolClient, type ShieldedPoolClientConfig } from './core/client.js';
import { ShieldedKeyring } from './core/identity.js';
import { DepositService } from './services/deposit.service.js';
import { ApprovalService } from './services/approval.service.js';
import { BalanceService } from './services/balance.service.js';
import { UnshieldService } from './services/unshield.service.js';
import type {
  DepositParams,
  DepositExecutionResult,
  ShieldedBalanceResult,
  PreparedShieldTx,
} from './types/deposit.types.js';
import type { ShieldedAddress } from './types/keys.types.js';
import type { UnshieldParams, UnshieldResult } from './types/unshield.types.js';
import type { WalletClient } from 'viem';

export class ShieldedPool {
  private depositService: DepositService;
  private approvalService: ApprovalService;
  private balanceService: BalanceService;
  private unshieldService: UnshieldService;

  private constructor(public readonly client: ShieldedPoolClient) {
    this.depositService = new DepositService(client);
    this.approvalService = new ApprovalService(
      client.publicClient,
      client.chainConfig.railgunContract
    );
    this.balanceService = new BalanceService(client);
    this.unshieldService = new UnshieldService(client);
  }

  /**
   * Factory method to create and initialize a ShieldedPool instance.
   */
  static async create(config?: ShieldedPoolClientConfig): Promise<ShieldedPool> {
    const client = new ShieldedPoolClient(config);
    await client.initialize();
    return new ShieldedPool(client);
  }

  /**
   * Get the leader's private shielded address (0zk...).
   */
  getShieldedAddress(): ShieldedAddress {
    return this.client.getShieldedAddress();
  }

  /**
   * Prepare a deposit transaction (generates Commitment / String A and calldata).
   */
  async prepareDeposit(params: DepositParams): Promise<{
    approvalRequired: boolean;
    approvalTx?: PreparedShieldTx;
    depositTxs: PreparedShieldTx[];
  }> {
    return this.depositService.prepareDeposit(params);
  }

  /**
   * Execute deposit on-chain using a provided Viem WalletClient.
   */
  async executeDeposit(
    params: DepositParams,
    walletClient: WalletClient
  ): Promise<DepositExecutionResult> {
    return this.depositService.executeDeposit(params, walletClient);
  }

  /**
   * Query the leader's current private shielded balance & unspent notes.
   */
  async getBalance(assetSymbol: 'ETH' | 'WETH' | 'USDC' | string): Promise<ShieldedBalanceResult> {
    return this.balanceService.getShieldedBalance(assetSymbol);
  }

  /**
   * Anonymously withdraw from the shielded pool via Pimlico relayer.
   * Leader's EOA is never the on-chain sender. Requires bundlerUrl + smartAccountPrivateKey in config.
   */
  async unshield(params: UnshieldParams): Promise<UnshieldResult> {
    return this.unshieldService.unshield(params);
  }
}

// Re-export core classes & configs
export { ShieldedPoolClient } from './core/client.js';
export { ShieldedKeyring } from './core/identity.js';
export { DepositService } from './services/deposit.service.js';
export { ApprovalService } from './services/approval.service.js';
export { BalanceService } from './services/balance.service.js';
export { UnshieldService } from './services/unshield.service.js';
export { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from './config/chains.js';
export { SEPOLIA_TOKENS } from './config/tokens.js';

// Re-export types
export * from './types/deposit.types.js';
export * from './types/keys.types.js';
export * from './types/unshield.types.js';

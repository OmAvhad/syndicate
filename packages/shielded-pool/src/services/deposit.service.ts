import type { WalletClient } from 'viem';
import type { ShieldedPoolClient } from '../core/client.js';
import { ApprovalService } from './approval.service.js';
import { SEPOLIA_TOKENS } from '../config/tokens.js';
import type {
  DepositParams,
  PreparedShieldTx,
  DepositExecutionResult,
} from '../types/deposit.types.js';

export class DepositService {
  private approvalService: ApprovalService;

  constructor(private client: ShieldedPoolClient) {
    this.approvalService = new ApprovalService(
      this.client.publicClient,
      this.client.chainConfig.railgunContract
    );
  }

  async prepareDeposit(params: DepositParams): Promise<{
    approvalRequired: boolean;
    approvalTx?: PreparedShieldTx;
    depositTxs: PreparedShieldTx[];
  }> {
    const plugin = this.client.getPlugin();
    const tokenConfig = SEPOLIA_TOKENS[params.assetSymbol];

    let assetPayload: any;
    let approvalRequired = false;
    let approvalTx: PreparedShieldTx | undefined;

    if (tokenConfig?.isNative || params.assetSymbol === 'ETH') {
      assetPayload = {
        asset: { __type: 'native' },
        amount: params.amount,
      };
    } else {
      const contract = params.tokenAddress || tokenConfig?.address;
      if (!contract) {
        throw new Error(`Token address required for non-native asset: ${params.assetSymbol}`);
      }

      assetPayload = {
        asset: { __type: 'erc20', contract },
        amount: params.amount,
      };
    }

    // Prepare shield calls via Kohaku Railgun Plugin
    const rawTxs = await plugin.prepareShield(assetPayload);

    const depositTxs: PreparedShieldTx[] = rawTxs.map((tx: any) => ({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || 0),
      description: `Shield ${params.amount} ${params.assetSymbol} into private balance`,
    }));

    return {
      approvalRequired,
      approvalTx,
      depositTxs,
    };
  }

  async executeDeposit(
    params: DepositParams,
    walletClient: WalletClient
  ): Promise<DepositExecutionResult> {
    const [address] = await walletClient.getAddresses();
    if (!address && !walletClient.account) {
      throw new Error('No account found in walletClient');
    }
    const account = walletClient.account ?? address;
    const accountAddress = typeof account === 'string' ? account : account.address;

    const tokenConfig = SEPOLIA_TOKENS[params.assetSymbol];
    const isErc20 = !tokenConfig?.isNative && params.assetSymbol !== 'ETH';
    const tokenAddress = params.tokenAddress || tokenConfig?.address;

    // Handle ERC-20 approval if needed
    if (isErc20 && tokenAddress) {
      const allowance = await this.approvalService.checkAllowance(
        tokenAddress,
        accountAddress,
        params.amount
      );

      if (allowance.needsApproval) {
        console.log(`[DepositService] Submitting approval for ${params.amount} ${params.assetSymbol}...`);
        await this.approvalService.executeApprove(tokenAddress, params.amount, walletClient);
        console.log('[DepositService] Approval confirmed.');
      }
    }

    // Build deposit transactions via Kohaku
    const { depositTxs } = await this.prepareDeposit(params);
    if (depositTxs.length === 0) {
      throw new Error('Kohaku prepareShield returned no transactions');
    }

    const primaryTx = depositTxs[0];

    // Submit deposit transaction
    const txHash = await walletClient.sendTransaction({
      account,
      chain: walletClient.chain,
      to: primaryTx.to,
      data: primaryTx.data,
      value: primaryTx.value,
    });

    console.log(`[DepositService] Shield transaction submitted: ${txHash}`);
    const receipt = await this.client.publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      asset: params.assetSymbol,
      amount: params.amount,
      shieldedAddress: this.client.getShieldedAddress(),
    };
  }
}

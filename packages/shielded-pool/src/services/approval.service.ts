import { parseAbi, type PublicClient, type WalletClient } from 'viem';
import type { PreparedShieldTx } from '../types/deposit.types.js';

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

export interface AllowanceCheckResult {
  needsApproval: boolean;
  currentAllowance: bigint;
  requiredAmount: bigint;
  approvalTx?: PreparedShieldTx;
}

export class ApprovalService {
  constructor(
    private publicClient: PublicClient,
    private poolAddress: `0x${string}`
  ) {}

  async checkAllowance(
    tokenAddress: `0x${string}`,
    ownerAddress: `0x${string}`,
    requiredAmount: bigint
  ): Promise<AllowanceCheckResult> {
    const currentAllowance = await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [ownerAddress, this.poolAddress],
    });

    const needsApproval = currentAllowance < requiredAmount;

    let approvalTx: PreparedShieldTx | undefined;
    if (needsApproval) {
      // Prepare approval call data (infinite or exact)
      const data = await this.encodeApproveData(this.poolAddress, requiredAmount);
      approvalTx = {
        to: tokenAddress,
        data,
        value: 0n,
        description: `Approve ${requiredAmount} tokens for Shielded Pool`,
      };
    }

    return {
      needsApproval,
      currentAllowance,
      requiredAmount,
      approvalTx,
    };
  }

  async executeApprove(
    tokenAddress: `0x${string}`,
    requiredAmount: bigint,
    walletClient: WalletClient
  ): Promise<`0x${string}`> {
    const [address] = await walletClient.getAddresses();
    if (!address && !walletClient.account) {
      throw new Error('No account found in walletClient');
    }
    const account = walletClient.account ?? address;

    const txHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [this.poolAddress, requiredAmount],
      account,
      chain: walletClient.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  private async encodeApproveData(spender: `0x${string}`, amount: bigint): Promise<`0x${string}`> {
    const { encodeFunctionData } = await import('viem');
    return encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
    });
  }
}

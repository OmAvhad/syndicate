import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

const abi = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
];

for (const address of [
  '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
  '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
]) {
  try {
    const symbol = await client.readContract({ address, abi, functionName: 'symbol' });
    const decimals = await client.readContract({ address, abi, functionName: 'decimals' });
    console.log(address, '->', symbol, decimals);
  } catch (e) {
    console.log(address, '-> ERROR', e.shortMessage || e.message);
  }
}

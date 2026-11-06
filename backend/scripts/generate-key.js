import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log('====================================================');
console.log('🔑 Brand New Backend Wallet Generated');
console.log('====================================================');
console.log('Public Address: ', account.address);
console.log('Private Key:    ', privateKey);
console.log('====================================================');
console.log('Next steps:');
console.log('1. Copy the Public Address and claim testnet tGLM at:');
console.log('   https://hub.arkiv.network/faucet');
console.log('2. Add to your .env:');
console.log(`   ARKIV_PRIVATE_KEY="${privateKey}"`);
console.log('====================================================');


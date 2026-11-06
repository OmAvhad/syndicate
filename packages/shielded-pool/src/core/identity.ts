import { MnemonicKeystore } from '@kohaku-eth/plugins';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { hexToBytes } from 'viem';
import type { ShieldedKeyringConfig } from '../types/keys.types.js';

export class ShieldedKeyring {
  private keystore: MnemonicKeystore;
  private keyIndex: number;

  constructor(config?: ShieldedKeyringConfig) {
    this.keyIndex = config?.keyIndex ?? 0;
    if (config?.mnemonic) {
      this.keystore = new MnemonicKeystore(config.mnemonic);
    } else {
      this.keystore = MnemonicKeystore.random();
    }
  }

  static fromMnemonic(mnemonic: string, keyIndex = 0): ShieldedKeyring {
    return new ShieldedKeyring({ mnemonic, keyIndex });
  }

  static fromPrivateKey(privateKey: `0x${string}`, keyIndex = 0): ShieldedKeyring {
    const cleanPk = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const bytes = hexToBytes(cleanPk);
    const mnemonic = entropyToMnemonic(bytes, wordlist);
    return new ShieldedKeyring({ mnemonic, keyIndex });
  }

  static createRandom(keyIndex = 0): ShieldedKeyring {
    return new ShieldedKeyring({ keyIndex });
  }

  getKeystore(): MnemonicKeystore {
    return this.keystore;
  }

  getKeyIndex(): number {
    return this.keyIndex;
  }
}

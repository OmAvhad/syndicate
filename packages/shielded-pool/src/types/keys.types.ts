export type ShieldedAddress = `0zk${string}`;

export interface ShieldedKeyringConfig {
  mnemonic?: string;
  keyIndex?: number;
}

export interface ShieldedIdentity {
  shieldedAddress: ShieldedAddress;
  keyIndex: number;
}

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { parseEther, parseUnits, formatUnits, formatEther, isAddress, encodeFunctionData, parseAbi } from 'viem';
import { ShieldedPool, ShieldedKeyring, SEPOLIA_TOKENS } from '../src/index.js';

// Prevent uncaught WASM panic from terminating the server process
process.on('uncaughtException', (err) => {
  console.error('[Server UncaughtException]', err.message || err);
});

const PORT = process.env.UI_PORT ? parseInt(process.env.UI_PORT) : 3333;
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const PIMLICO_KEY = process.env.PIMLICO_API_KEY || '';
const BUNDLER_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_KEY}`;
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`;

// Async Mutex to prevent Rust WASM concurrent borrowing collisions
class Mutex {
  private queue: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = this.queue;
    this.queue = this.queue.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

const poolLock = new Mutex();
let pool: ShieldedPool | null = null;
let isInitializing = false;
let initError: string | null = null;

// Cache status for 5 seconds to prevent spamming WASM
let cachedStatus: any = null;
let lastStatusTime = 0;

async function getPool(): Promise<ShieldedPool> {
  if (pool) return pool;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (pool) return pool;
    throw new Error(initError || 'Failed to initialize pool');
  }

  isInitializing = true;
  try {
    console.log('[Server] Initializing ShieldedPool with Kohaku WASM & Pimlico...');
    const keyring = ShieldedKeyring.fromPrivateKey(PRIVATE_KEY);
    pool = await ShieldedPool.create({
      rpcUrl: RPC_URL,
      keyring,
      bundlerUrl: BUNDLER_URL,
      smartAccountPrivateKey: PRIVATE_KEY,
    });
    console.log('[Server] ShieldedPool initialized! Address:', pool.getShieldedAddress());
    return pool;
  } catch (err: any) {
    initError = err.message || String(err);
    console.error('[Server] Pool initialization failed:', err);
    throw err;
  } finally {
    isInitializing = false;
  }
}

// Pre-initialize in background
getPool().catch(() => {});

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Syndicate Shielded Pool — Multi-Asset Privacy Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              400: '#34d399',
              500: '#10b981',
              600: '#059669',
            },
            darkBg: '#090d16',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #090d16; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glow { box-shadow: 0 0 25px -5px rgba(16, 185, 129, 0.25); }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
  <!-- Top Navigation -->
  <header class="border-b border-gray-800/80 bg-gray-950/60 sticky top-0 z-50 backdrop-blur-md">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-cyan-500 flex items-center justify-center font-black text-black text-lg">
          S
        </div>
        <div>
          <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
            Syndicate Shielded Pool
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Sepolia</span>
          </h1>
          <p class="text-[11px] text-gray-400">Multi-Asset Privacy (ETH, USDC & ERC-20) via Railgun + Pimlico</p>
        </div>
      </div>

      <!-- Wallet Connect Button -->
      <div class="flex items-center gap-3">
        <button id="connectBtn" onclick="connectWallet()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-gray-950 transition flex items-center gap-2 shadow-lg shadow-brand-500/20">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          <span id="connectBtnText">Connect MetaMask</span>
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
    <!-- Status / Info Bar -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="glass p-5 rounded-2xl space-y-1">
        <div class="text-xs font-medium text-gray-400 flex items-center justify-between">
          <span>Connected MetaMask</span>
          <span id="networkBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">Not Connected</span>
        </div>
        <div id="userAddressDisplay" class="font-mono text-sm font-semibold text-gray-200 truncate">Not connected</div>
        <div id="userBalancesDisplay" class="text-xs text-gray-400">ETH: — | USDC: —</div>
      </div>

      <div class="glass p-5 rounded-2xl space-y-1">
        <div class="text-xs font-medium text-gray-400 flex items-center justify-between">
          <span>Private Shielded Pool Balance</span>
          <button onclick="fetchStatus(true)" title="Refresh balance" class="hover:text-emerald-400 transition text-gray-500">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
        <div id="shieldedEthDisplay" class="font-mono text-sm font-bold text-emerald-400">ETH: Loading...</div>
        <div id="shieldedUsdcDisplay" class="font-mono text-xs font-semibold text-cyan-400">USDC: Loading...</div>
      </div>

      <div class="glass p-5 rounded-2xl space-y-1">
        <div class="text-xs font-medium text-gray-400">Relayer Engine</div>
        <div class="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Pimlico Bundler (ERC-4337)
        </div>
        <div class="text-[11px] text-gray-400 font-mono truncate">Gas paid via shielded WETH note</div>
      </div>
    </div>

    <!-- Shielded Address Box -->
    <div class="glass p-4 rounded-xl flex items-center justify-between gap-4 border-emerald-500/20 bg-emerald-950/10">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <div class="overflow-hidden">
          <div class="text-xs font-semibold text-emerald-400">Your Shielded Railgun Address</div>
          <div id="shieldedAddressDisplay" class="font-mono text-xs text-gray-300 truncate">Loading...</div>
        </div>
      </div>
      <button onclick="copyShieldedAddress()" class="px-3 py-1.5 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 transition font-medium shrink-0">
        Copy
      </button>
    </div>

    <!-- Main Tabs -->
    <div class="glass rounded-2xl overflow-hidden glow">
      <div class="border-b border-gray-800 flex">
        <button id="tabDepositBtn" onclick="switchTab('deposit')" class="flex-1 py-4 text-center text-sm font-semibold border-b-2 border-emerald-500 text-emerald-400 transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
          1. Deposit Asset to Pool
        </button>
        <button id="tabUnshieldBtn" onclick="switchTab('unshield')" class="flex-1 py-4 text-center text-sm font-semibold border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          2. Anonymously Transfer via Relayer
        </button>
      </div>

      <div class="p-8">
        <!-- DEPOSIT TAB -->
        <div id="depositTab" class="space-y-6 max-w-xl mx-auto">
          <div>
            <h2 class="text-lg font-bold text-white">Deposit Any Asset into Shielded Pool</h2>
            <p class="text-xs text-gray-400 mt-1">
              Supports native <b>ETH</b>, testnet <b>USDC</b>, or any standard ERC-20. Funds are locked into a cryptographic commitment.
            </p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Select Asset</label>
              <select id="depositAssetSelect" onchange="onDepositAssetChange()" class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-brand-500">
                <option value="ETH">Sepolia ETH (Native)</option>
                <option value="USDC">USDC (Testnet — 0x1c7D...7238)</option>
                <option value="CUSTOM">Custom ERC-20 Token Address...</option>
              </select>
            </div>

            <div id="customTokenBox" class="hidden">
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Custom Token Contract Address</label>
              <input id="customTokenAddress" type="text" placeholder="0x..." class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-semibold text-gray-300">Amount to Deposit</label>
                <span id="depositBalanceHint" class="text-[11px] text-gray-500">MetaMask Balance: —</span>
              </div>
              <input id="depositAmount" type="number" step="any" min="0" value="0.002" placeholder="0.002" class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-brand-500">
            </div>

            <button id="executeDepositBtn" onclick="executeDeposit()" class="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-400 text-gray-950 transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20">
              <span id="depositBtnSpinner" class="hidden w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin"></span>
              <span id="depositBtnText">Deposit via MetaMask</span>
            </button>
          </div>

          <div id="depositStatusBox" class="hidden p-4 rounded-xl text-xs space-y-1"></div>
        </div>

        <!-- UNSHIELD TAB -->
        <div id="unshieldTab" class="hidden space-y-6 max-w-xl mx-auto">
          <div>
            <h2 class="text-lg font-bold text-white">Anonymous Transfer via Pimlico Relayer</h2>
            <p class="text-xs text-gray-400 mt-1">
              Transfers funds from your private balance to any wallet. 
              <span class="text-emerald-400 font-semibold">Your MetaMask address never appears on-chain.</span>
            </p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Select Asset to Send</label>
              <select id="unshieldAssetSelect" onchange="onUnshieldAssetChange()" class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-brand-500">
                <option value="ETH">ETH (Delivered directly to recipient)</option>
                <option value="USDC">USDC (Delivered directly to recipient)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1.5">Destination Wallet Address</label>
              <input id="unshieldDest" type="text" value="${process.env.DESTINATION_ADDRESS || '0x9C14b0Ffe97c3074C71314D3a330b5F847bf2294'}" placeholder="0x..." class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-brand-500">
              <p class="text-[11px] text-gray-500 mt-1">Can be any valid Ethereum wallet address.</p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-semibold text-gray-300">Amount to Transfer</label>
                <span id="unshieldMaxHint" class="text-[11px] text-gray-500">Available: —</span>
              </div>
              <input id="unshieldAmount" type="number" step="any" min="0" value="0.001" placeholder="0.001" class="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-brand-500">
            </div>

            <div class="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 text-[11px] text-gray-400 space-y-1">
              <div class="flex items-center justify-between text-gray-300">
                <span>Relayer Fee:</span>
                <span class="font-mono text-emerald-400">~0.002 WETH (Sponsored via shielded note)</span>
              </div>
              <div class="flex items-center justify-between text-gray-300">
                <span>Direct Delivery:</span>
                <span class="font-mono text-white">Paid straight from Railgun Privacy Pool</span>
              </div>
            </div>

            <button id="executeUnshieldBtn" onclick="executeUnshield()" class="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-gray-950 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
              <span id="unshieldBtnSpinner" class="hidden w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin"></span>
              <span id="unshieldBtnText">Send Anonymously via Relayer</span>
            </button>
          </div>

          <div id="unshieldStatusBox" class="hidden p-4 rounded-xl text-xs space-y-2"></div>
        </div>
      </div>
    </div>

    <!-- Live Activity Log -->
    <div class="glass p-6 rounded-2xl space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">Live Activity & On-Chain Proofs</h3>
        <span class="text-xs text-gray-500 font-mono">Sepolia Testnet</span>
      </div>
      <div id="activityList" class="space-y-2.5">
        <div class="p-3 rounded-xl bg-gray-900/40 border border-gray-800/60 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-semibold text-gray-300">Verified Relayer Payout</span>
            <span class="text-gray-500 font-mono">0.001 ETH</span>
          </div>
          <a href="https://sepolia.etherscan.io/tx/0x273ae700bb7c61a1081bb9b3f89d010ff3c6a24e94c2d172e79e700423859496" target="_blank" class="text-emerald-400 hover:underline font-mono">
            0x273ae7...9496 ↗
          </a>
        </div>
      </div>
    </div>
  </main>

  <script>
    let userAddress = null;
    let poolBalances = { ETH: '0', USDC: '0' };
    const USDC_ADDRESS = '${SEPOLIA_TOKENS.USDC.address}';

    async function connectWallet() {
      if (!window.ethereum) {
        alert('MetaMask is not installed. Please install MetaMask to use this app.');
        return;
      }
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          userAddress = accounts[0];
          updateWalletUI();
          checkNetwork();
        }
      } catch (err) {
        console.error('MetaMask connection failed:', err);
      }
    }

    async function checkNetwork() {
      if (!window.ethereum) return;
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const sepoliaChainId = '0xaa36a7';
      const badge = document.getElementById('networkBadge');
      if (chainId === sepoliaChainId) {
        badge.innerText = 'Sepolia (11155111)';
        badge.className = 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        fetchUserBalances();
      } else {
        badge.innerText = 'Wrong Network (Click to Switch to Sepolia)';
        badge.className = 'text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 cursor-pointer';
        badge.onclick = switchNetwork;
      }
    }

    async function switchNetwork() {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        });
        checkNetwork();
      } catch (err) {
        console.error('Failed to switch network:', err);
      }
    }

    async function fetchUserBalances() {
      if (!window.ethereum || !userAddress) return;
      try {
        // ETH
        const ethHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [userAddress, 'latest']
        });
        const eth = (Number(BigInt(ethHex)) / 1e18).toFixed(4);

        // USDC balanceOf call (0x70a08231 + padded address)
        let usdc = '0.00';
        try {
          const usdcHex = await window.ethereum.request({
            method: 'eth_call',
            params: [{
              to: USDC_ADDRESS,
              data: '0x70a08231000000000000000000000000' + userAddress.replace('0x', '')
            }, 'latest']
          });
          if (usdcHex && usdcHex !== '0x') {
            usdc = (Number(BigInt(usdcHex)) / 1e6).toFixed(2);
          }
        } catch {}

        document.getElementById('userBalancesDisplay').innerText = 'ETH: ' + eth + ' | USDC: ' + usdc;
        updateDepositBalanceHint(eth, usdc);
      } catch (e) {}
    }

    function updateDepositBalanceHint(eth, usdc) {
      const asset = document.getElementById('depositAssetSelect').value;
      const hint = document.getElementById('depositBalanceHint');
      if (asset === 'ETH') hint.innerText = 'MetaMask Balance: ' + (eth || '—') + ' ETH';
      else if (asset === 'USDC') hint.innerText = 'MetaMask Balance: ' + (usdc || '—') + ' USDC';
      else hint.innerText = 'MetaMask Balance: —';
    }

    function onDepositAssetChange() {
      const asset = document.getElementById('depositAssetSelect').value;
      const customBox = document.getElementById('customTokenBox');
      const amountInput = document.getElementById('depositAmount');
      if (asset === 'CUSTOM') {
        customBox.classList.remove('hidden');
      } else {
        customBox.classList.add('hidden');
      }

      if (asset === 'USDC') {
        amountInput.value = '5';
        amountInput.step = '1';
      } else if (asset === 'ETH') {
        amountInput.value = '0.002';
        amountInput.step = '0.001';
      }
      fetchUserBalances();
    }

    function onUnshieldAssetChange() {
      const asset = document.getElementById('unshieldAssetSelect').value;
      const amountInput = document.getElementById('unshieldAmount');
      const maxHint = document.getElementById('unshieldMaxHint');
      if (asset === 'USDC') {
        amountInput.value = '1';
        amountInput.step = '0.5';
        maxHint.innerText = 'Shielded Balance: ' + (poolBalances.USDC || '0 USDC');
      } else {
        amountInput.value = '0.001';
        amountInput.step = '0.0005';
        maxHint.innerText = 'Shielded Balance: ' + (poolBalances.ETH || '0 ETH');
      }
    }

    function updateWalletUI() {
      if (!userAddress) return;
      const shortAddr = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
      document.getElementById('connectBtnText').innerText = shortAddr;
      document.getElementById('userAddressDisplay').innerText = userAddress;
      fetchUserBalances();
    }

    function switchTab(tab) {
      const depTab = document.getElementById('depositTab');
      const unshTab = document.getElementById('unshieldTab');
      const depBtn = document.getElementById('tabDepositBtn');
      const unshBtn = document.getElementById('tabUnshieldBtn');

      if (tab === 'deposit') {
        depTab.classList.remove('hidden');
        unshTab.classList.add('hidden');
        depBtn.className = 'flex-1 py-4 text-center text-sm font-semibold border-b-2 border-emerald-500 text-emerald-400 transition flex items-center justify-center gap-2';
        unshBtn.className = 'flex-1 py-4 text-center text-sm font-semibold border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition flex items-center justify-center gap-2';
      } else {
        unshTab.classList.remove('hidden');
        depTab.classList.add('hidden');
        unshBtn.className = 'flex-1 py-4 text-center text-sm font-semibold border-b-2 border-emerald-500 text-emerald-400 transition flex items-center justify-center gap-2';
        depBtn.className = 'flex-1 py-4 text-center text-sm font-semibold border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition flex items-center justify-center gap-2';
      }
    }

    async function fetchStatus(force) {
      try {
        const res = await fetch('/api/status' + (force ? '?refresh=true' : ''));
        const data = await res.json();
        if (data.shieldedAddress) {
          document.getElementById('shieldedAddressDisplay').innerText = data.shieldedAddress;
        }
        if (data.balances) {
          poolBalances.ETH = data.balances.ETH?.formatted || '0 ETH';
          poolBalances.USDC = data.balances.USDC?.formatted || '0 USDC';
          document.getElementById('shieldedEthDisplay').innerText = 'ETH: ' + poolBalances.ETH;
          document.getElementById('shieldedUsdcDisplay').innerText = 'USDC: ' + poolBalances.USDC;
          onUnshieldAssetChange();
        }
      } catch (err) {
        console.error('Failed to fetch pool status:', err);
      }
    }

    function copyShieldedAddress() {
      const addr = document.getElementById('shieldedAddressDisplay').innerText;
      if (addr && addr.startsWith('0zk')) {
        navigator.clipboard.writeText(addr);
        alert('Copied shielded address to clipboard!');
      }
    }

    async function executeDeposit() {
      if (!userAddress) {
        alert('Please connect MetaMask first!');
        return;
      }
      const asset = document.getElementById('depositAssetSelect').value;
      const customAddr = document.getElementById('customTokenAddress').value.trim();
      const amount = document.getElementById('depositAmount').value;

      if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid deposit amount');
        return;
      }

      const btn = document.getElementById('executeDepositBtn');
      const spinner = document.getElementById('depositBtnSpinner');
      const btnText = document.getElementById('depositBtnText');
      const statusBox = document.getElementById('depositStatusBox');

      btn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.innerText = 'Checking Allowance...';
      statusBox.classList.remove('hidden');
      statusBox.className = 'p-4 rounded-xl text-xs space-y-1 bg-blue-950/30 border border-blue-500/20 text-blue-300';
      statusBox.innerHTML = '<div>⏳ Preparing ' + asset + ' deposit parameters...</div>';

      try {
        const prepRes = await fetch('/api/prepare-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            assetSymbol: asset === 'CUSTOM' ? 'CUSTOM' : asset,
            tokenAddress: asset === 'CUSTOM' ? customAddr : undefined,
            userAddress
          })
        });
        const prepData = await prepRes.json();
        if (!prepData.success) {
          throw new Error(prepData.error || 'Failed to prepare deposit');
        }

        // 1. If ERC20 approval is required, submit approval first and wait for receipt!
        if (prepData.approvalRequired && prepData.approvalTx) {
          btnText.innerText = '1/2: Approve in MetaMask...';
          statusBox.innerHTML += '<div>🔑 <b>Step 1/2</b>: Please approve ' + asset + ' allowance in MetaMask...</div>';

          const appTx = prepData.approvalTx;
          const appHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: userAddress,
              to: appTx.to,
              data: appTx.data,
              value: '0x0',
            }]
          });
          statusBox.innerHTML += '<div>⏳ Approval submitted: <a href="https://sepolia.etherscan.io/tx/' + appHash + '" target="_blank" class="underline font-mono">' + appHash.slice(0, 10) + '... ↗</a> (Waiting for on-chain confirmation...)</div>';
          
          // Poll until approval is mined on-chain!
          let mined = false;
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const receipt = await window.ethereum.request({
              method: 'eth_getTransactionReceipt',
              params: [appHash]
            });
            if (receipt && receipt.blockNumber) {
              mined = true;
              break;
            }
          }
          if (!mined) {
            throw new Error('Approval transaction timed out on Sepolia. Please try again.');
          }
          statusBox.innerHTML += '<div>✅ Approval confirmed! Proceeding to Shield Deposit...</div>';
        }

        // 2. Submit the Shield transaction!
        btnText.innerText = '2/2: Confirm Deposit in MetaMask...';
        statusBox.innerHTML += '<div>🔐 Step 2/2: Please confirm the Shield Deposit in MetaMask...</div>';

        const tx = prepData.depositTx;
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: userAddress,
            to: tx.to,
            data: tx.data,
            value: tx.value,
          }]
        });

        statusBox.className = 'p-4 rounded-xl text-xs space-y-1 bg-emerald-950/30 border border-emerald-500/20 text-emerald-300';
        statusBox.innerHTML = '<div>✅ <b>' + asset + ' Deposit Broadcasted!</b></div>' +
          '<div>Tx Hash: <a href="https://sepolia.etherscan.io/tx/' + txHash + '" target="_blank" class="underline font-mono">' + txHash + ' ↗</a></div>' +
          '<div class="text-gray-400">Funds are now private in your shielded pool! Syncing balance...</div>';

        addActivityItem('Deposit ' + amount + ' ' + asset, txHash);

        setTimeout(() => fetchStatus(true), 8000);
        setTimeout(() => fetchStatus(true), 20000);
        setTimeout(fetchUserBalances, 8000);
      } catch (err) {
        console.error(err);
        statusBox.className = 'p-4 rounded-xl text-xs space-y-1 bg-red-950/30 border border-red-500/20 text-red-300';
        statusBox.innerHTML = '<div>❌ <b>Deposit Failed</b>: ' + (err.message || err) + '</div>';
      } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        btnText.innerText = 'Deposit via MetaMask';
      }
    }

    async function executeUnshield() {
      const asset = document.getElementById('unshieldAssetSelect').value;
      const dest = document.getElementById('unshieldDest').value.trim();
      const amount = document.getElementById('unshieldAmount').value;

      if (!dest || !dest.startsWith('0x') || dest.length !== 42) {
        alert('Please enter a valid 0x destination wallet address');
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const btn = document.getElementById('executeUnshieldBtn');
      const spinner = document.getElementById('unshieldBtnSpinner');
      const btnText = document.getElementById('unshieldBtnText');
      const statusBox = document.getElementById('unshieldStatusBox');

      btn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.innerText = 'Building ZK Proof (WASM)...';
      statusBox.classList.remove('hidden');
      statusBox.className = 'p-4 rounded-xl text-xs space-y-2 bg-blue-950/30 border border-blue-500/20 text-blue-300';
      statusBox.innerHTML = '<div>🔐 <b>Step 1/3</b>: Generating Zero-Knowledge SNARK proof locally...</div>' +
        '<div class="text-[11px] text-gray-400">Selecting ' + asset + ' note + WETH gas fee note...</div>';

      try {
        const res = await fetch('/api/unshield', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationAddress: dest, amount, assetSymbol: asset })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Unshield relay failed');
        }

        statusBox.className = 'p-4 rounded-xl text-xs space-y-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-300';
        statusBox.innerHTML = '<div>✅ <b>ANONYMOUS ' + asset + ' TRANSFER CONFIRMED ON SEPOLIA!</b></div>' +
          '<div>Amount Released: <b>' + amount + ' ' + asset + '</b> to <b>' + dest.slice(0, 6) + '...' + dest.slice(-4) + '</b></div>' +
          (data.txHash && data.txHash !== '0x' ? '<div>Tx: <a href="https://sepolia.etherscan.io/tx/' + data.txHash + '" target="_blank" class="underline font-mono">' + data.txHash + ' ↗</a></div>' : '') +
          '<div>Destination Wallet: <a href="https://sepolia.etherscan.io/address/' + dest + '" target="_blank" class="underline font-mono">' + dest + ' ↗</a></div>' +
          '<div class="text-[11px] text-emerald-400 font-semibold">🔒 Your MetaMask wallet never appeared as the on-chain sender. Complete ZK privacy!</div>';

        if (data.txHash && data.txHash !== '0x') {
          addActivityItem('Unshield ' + amount + ' ' + asset + ' → ' + dest.slice(0, 6) + '...', data.txHash);
        }

        setTimeout(() => fetchStatus(true), 4000);
      } catch (err) {
        console.error(err);
        statusBox.className = 'p-4 rounded-xl text-xs space-y-1 bg-red-950/30 border border-red-500/20 text-red-300';
        statusBox.innerHTML = '<div>❌ <b>Unshield Failed</b>: ' + (err.message || err) + '</div>';
      } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        btnText.innerText = 'Send Anonymously via Relayer';
      }
    }

    function addActivityItem(label, txHash) {
      const list = document.getElementById('activityList');
      const item = document.createElement('div');
      item.className = 'p-3 rounded-xl bg-gray-900/40 border border-gray-800/60 flex items-center justify-between text-xs animate-fade-in';
      item.innerHTML = '<div class="flex items-center gap-2">' +
        '<span class="w-2 h-2 rounded-full bg-emerald-400"></span>' +
        '<span class="font-semibold text-gray-200">' + label + '</span>' +
        '</div>' +
        '<a href="https://sepolia.etherscan.io/tx/' + txHash + '" target="_blank" class="text-emerald-400 hover:underline font-mono">' +
        txHash.slice(0, 10) + '... ↗' +
        '</a>';
      list.prepend(item);
    }

    // Auto-init
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accs => {
        if (accs && accs[0]) {
          userAddress = accs[0];
          updateWalletUI();
          checkNetwork();
        }
      });
      window.ethereum.on('accountsChanged', accs => {
        userAddress = accs[0] || null;
        updateWalletUI();
      });
      window.ethereum.on('chainChanged', () => checkNetwork());
    }
    fetchStatus();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // 1. Serve Web UI
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  // 2. GET /api/status — Multi-asset balances with Mutex & Caching
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const isRefresh = url.searchParams.get('refresh') === 'true';
    const now = Date.now();

    if (!isRefresh && cachedStatus && (now - lastStatusTime < 5000)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cachedStatus));
      return;
    }

    try {
      const data = await poolLock.run(async () => {
        const p = await getPool();
        const ethBal = await p.getBalance('ETH');
        const usdcBal = await p.getBalance('USDC');

        return {
          success: true,
          shieldedAddress: p.getShieldedAddress(),
          balances: {
            ETH: {
              raw: ethBal.amount.toString(),
              formatted: ethBal.formatted,
              notesCount: ethBal.notes.length,
            },
            USDC: {
              raw: usdcBal.amount.toString(),
              formatted: usdcBal.formatted,
              notesCount: usdcBal.notes.length,
            },
          },
        };
      });

      cachedStatus = data;
      lastStatusTime = now;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 3. POST /api/prepare-deposit — Multi-asset with ERC-20 approval check
  if (req.method === 'POST' && url.pathname === '/api/prepare-deposit') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { amount, assetSymbol = 'ETH', tokenAddress, userAddress } = JSON.parse(body || '{}');
        if (!amount || parseFloat(amount) <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid amount' }));
          return;
        }

        const data = await poolLock.run(async () => {
          const p = await getPool();
          const railgunContract = p.client.chainConfig.railgunContract;

          let parsedAmount: bigint;
          let targetTokenAddress: `0x${string}` | undefined;
          let isErc20 = false;

          if (assetSymbol === 'ETH') {
            parsedAmount = parseEther(amount.toString());
          } else if (assetSymbol === 'USDC') {
            parsedAmount = parseUnits(amount.toString(), SEPOLIA_TOKENS.USDC.decimals);
            targetTokenAddress = SEPOLIA_TOKENS.USDC.address;
            isErc20 = true;
          } else {
            if (!tokenAddress || !isAddress(tokenAddress)) {
              throw new Error('Valid token address required for custom ERC-20');
            }
            targetTokenAddress = tokenAddress;
            parsedAmount = parseEther(amount.toString());
            isErc20 = true;
          }

          let approvalRequired = false;
          let approvalTx: any = null;

          if (isErc20 && targetTokenAddress && userAddress && isAddress(userAddress)) {
            const allowance = await p.client.publicClient.readContract({
              address: targetTokenAddress,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [userAddress, railgunContract],
            });

            if (allowance < parsedAmount) {
              approvalRequired = true;
              const approveData = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [railgunContract, parsedAmount * 10n],
              });
              approvalTx = {
                to: targetTokenAddress,
                data: approveData,
                value: '0x0',
              };
            }
          }

          const { depositTxs } = await p.prepareDeposit({
            assetSymbol: isErc20 ? 'USDC' : 'ETH',
            tokenAddress: targetTokenAddress,
            amount: parsedAmount,
          });

          if (!depositTxs || depositTxs.length === 0) {
            throw new Error('No deposit transaction generated');
          }

          const primaryTx = depositTxs[0];
          return {
            success: true,
            approvalRequired,
            approvalTx,
            depositTx: {
              to: primaryTx.to,
              data: primaryTx.data,
              value: '0x' + primaryTx.value.toString(16),
            },
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 4. POST /api/unshield — Multi-asset unshield
  if (req.method === 'POST' && url.pathname === '/api/unshield') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { destinationAddress, amount, assetSymbol = 'WETH' } = JSON.parse(body || '{}');
        if (!destinationAddress || !isAddress(destinationAddress)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid destination address' }));
          return;
        }
        if (!amount || parseFloat(amount) <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid amount' }));
          return;
        }

        let parsedAmount: bigint;
        let actualSymbol = assetSymbol;

        if (assetSymbol === 'USDC') {
          parsedAmount = parseUnits(amount.toString(), SEPOLIA_TOKENS.USDC.decimals);
        } else {
          parsedAmount = parseEther(amount.toString());
          actualSymbol = 'WETH';
        }

        console.log(`[Server] Unshielding ${amount} ${assetSymbol} -> ${destinationAddress}`);
        const data = await poolLock.run(async () => {
          const p = await getPool();
          const result = await p.unshield({
            destinationAddress,
            amount: parsedAmount,
            assetSymbol: actualSymbol,
          });

          // Invalidate cache
          cachedStatus = null;

          return {
            success: true,
            userOpHash: result.userOpHash,
            destinationAddress: result.destinationAddress,
            amount: amount.toString(),
            assetSymbol,
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err: any) {
        console.error('[Server] Unshield error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Multi-Asset Privacy Portal UI: http://localhost:${PORT}`);
  console.log(`   Supports: ETH, USDC & ERC-20 Tokens`);
  console.log(`======================================================\n`);
});

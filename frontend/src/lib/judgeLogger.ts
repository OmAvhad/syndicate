/**
 * Judge Logger for Hackathon Evaluation (SyndicateCopy)
 * Automatically records application workflow events (Promises, Arkiv Entities, Onchain Swaps, Follower Copies, Exits)
 * Accessible anytime via browser console:
 *   - window.judgeLogs
 *   - window.getOutputMarkdown()
 *   - window.downloadJudgeLogs()
 */

export interface JudgeLogEntry {
  timestamp: string
  category: 'PROMISE' | 'ONCHAIN_TRADE' | 'ARKIV_SIGNAL' | 'FOLLOWER_COPY' | 'EXIT_SETTLEMENT' | 'BASE_INTENT'
  title: string
  details: Record<string, unknown>
  links?: { label: string; url: string }[]
}

declare global {
  interface Window {
    judgeLogs: JudgeLogEntry[]
    addJudgeLog: (entry: Omit<JudgeLogEntry, 'timestamp'>) => void
    getOutputMarkdown: () => string
    downloadJudgeLogs: () => void
  }
}

// Initialize on window if in browser environment
if (typeof window !== 'undefined') {
  if (!window.judgeLogs) {
    window.judgeLogs = []
  }

  window.addJudgeLog = (entry: Omit<JudgeLogEntry, 'timestamp'>) => {
    const fullEntry: JudgeLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    }
    window.judgeLogs.push(fullEntry)
    console.log(`%c[Judge Log: ${entry.category}] ${entry.title}`, 'color: #C6F36A; font-weight: bold;', entry.details)
  }

  window.getOutputMarkdown = () => {
    return generateOutputMarkdown(window.judgeLogs)
  }

  window.downloadJudgeLogs = () => {
    const md = generateOutputMarkdown(window.judgeLogs)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'output.md'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    console.log('%c✅ output.md successfully downloaded for judges!', 'color: #22C55E; font-weight: bold;')
  }
}

export function logJudgeEvent(entry: Omit<JudgeLogEntry, 'timestamp'>) {
  if (typeof window !== 'undefined' && window.addJudgeLog) {
    window.addJudgeLog(entry)
  }
}

export function generateOutputMarkdown(logs: JudgeLogEntry[]): string {
  const generatedAt = new Date().toISOString()

  let md = `# 🛡️ SyndicateCopy — Live Hackathon Verification Report (\`output.md\`)

> **Protocol:** Zero-Knowledge Privacy-Preserving Copy Trading Protocol  
> **Evaluation Tracks:** Definitive Flash ($2,500) • Arkiv ($4,000) • EF CROPS / Kohaku ($3,500) • World ID  
> **Generated Timestamp:** \`${generatedAt}\`  
> **Environment:** Ethereum Sepolia (L1), Base Mainnet (L2), Arkiv Rabdi Testnet  

---

## 🏛️ Executive Summary

SyndicateCopy eliminates public wallet tracking and sandwich bot front-running by separating trader identities from execution burners, anchoring sequential commitments in **Arkiv**, and executing via **Definitive Flash** advanced orders with zero linkage to the leader's main treasury.

* **Relayer / Signer Address (Arkiv Rabdi):** \`0x0962cC66c69426C32574447cF50fe9664fE94451\`
* **Static Execution Burner (Sepolia):** \`0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9\`
* **FlashTradePool Settlement Vault:** \`0xA360946725811DABB91C054A3DFF25eD25C005E8\`
* **Base Mainnet Chain ID:** \`8453\` (Production Solver Mode)

---

## 📜 Onchain Verification & Audit Trail (${logs.length} Workflow Events Recorded)

`

  if (logs.length === 0) {
    md += `*No workflow actions recorded in this session yet. Execute an order in the Leader Terminal (/trade) or Flash Terminal (/flash-trade) to populate live onchain proofs!*\n`
    return md
  }

  logs.forEach((log, index) => {
    md += `### Event #${index + 1}: [${log.category}] ${log.title}\n`
    md += `* **Timestamp:** \`${log.timestamp}\`\n\n`
    md += `| Parameter | Value |\n`
    md += `|---|---|\n`

    Object.entries(log.details).forEach(([key, val]) => {
      const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
      md += `| **${key}** | \`${displayVal}\` |\n`
    })

    if (log.links && log.links.length > 0) {
      md += `\n**🔗 Live Verification Links:**\n`
      log.links.forEach((link) => {
        md += `* [${link.label}](${link.url})\n`
      })
    }

    md += `\n---\n\n`
  })

  md += `## 📑 How Judges Can Verify This Output

1. **Arkiv Sealed Promises:**
   * Query the \`trade_promises\` schema using the entity keys listed above at \`https://testnet.explorer.arkiv.network\`.
   * Verify that the sequential index (\`Trade #N\`) is unbroken and the HMAC payload hash matches the trade parameters.
2. **Onchain Sepolia Transactions:**
   * Click any of the Sepolia Etherscan links above to verify that the atomic two-leg swap (USDC transfer $\\leftrightarrow$ WETH position delivery) took place with real gas and block confirmations.
3. **Arkiv Ephemeral Signals:**
   * Signals expire exactly 10 minutes (\`600s\`) after creation, ensuring no permanent state bloat and cutting off MEV front-runners.

---
*Report generated automatically by SyndicateCopy Client Logger (\`window.judgeLogs\`)*
`

  return md
}

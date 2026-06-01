# Blue 💙

A modern Arc-native Web3 fintech application built for stablecoin payments, swapping, bridging, and unified balances.

Blue is powered by:

- Arc Network
- External Web3 wallet connection
- Circle App Kit
- USDC-native gas system
- Viem
- React + Vite

---

# ✨ Features

## ✅ Authentication
- Injected browser wallet connection
- Existing wallet session restoration
- Arc Testnet support

## ✅ Wallet & Balances
- Native Arc USDC balance
- Unified wallet dashboard
- Real-time balance fetching

## ✅ Send
- Send native Arc USDC
- ERC20 transfers
- Instant settlement on Arc

## ✅ Swap
- USDC ↔ EURC swaps
- Powered by Circle App Kit Swap
- Arc-native stablecoin liquidity

## ✅ Crosschain Bridge
- Bridge USDC between chains
- Powered by Circle CCTP
- Arc App Kit integration

## ✅ Unified Balance
- Chain-agnostic USDC balance
- Deposit from multiple chains
- Spend from one unified balance

## ✅ Transaction Experience
- Instant finality
- Stable gas fees
- USDC-native gas token
- Optimized UX for fintech onboarding

---

# 🧱 Tech Stack

| Technology | Usage |
|---|---|
| React | Frontend |
| Vite | Build tool |
| TypeScript | Type safety |
| External Web3 wallet | Wallet connection |
| Viem | EVM interactions |
| Circle App Kit | Swaps + Bridge + Unified Balance |
| Arc Network | Blockchain infrastructure |

---

# 🌐 Arc Network

Blue is built on Arc Testnet.

## Arc Testnet Details

| Property | Value |
|---|---|
| Network | Arc Testnet |
| Chain ID | 5042002 |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| Native Gas Token | USDC |

---

# 🔐 Environment Variables

Create a `.env` file in the project root:

```env
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a

VITE_KIT_KEY=YOUR_CIRCLE_KIT_KEY

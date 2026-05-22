import type { Chain } from "viem"
import { normalizeCircleKitKey } from "./circle"

export const ARC_CHAIN_ID = Number(import.meta.env.VITE_ARC_CHAIN_ID ?? 5042002)
export const ARC_RPC = import.meta.env.VITE_ARC_RPC as string
export const ARC_EXPLORER_URL =
  (import.meta.env.VITE_ARC_EXPLORER_URL as string | undefined) ??
  "https://testnet.arcscan.app"

export const ARC_CHAIN: Chain = {
  id: ARC_CHAIN_ID,
  name: import.meta.env.VITE_ARC_CHAIN_NAME ?? "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: ARC_EXPLORER_URL,
    },
  },
}

export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`
export const EURC_ADDRESS = import.meta.env.VITE_EURC_ADDRESS as `0x${string}`
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
export const CIRCLE_KIT_KEY = normalizeCircleKitKey(
  import.meta.env.VITE_CIRCLE_KIT_KEY as string | undefined,
)

export const ACCOUNT_HISTORY_BLOCK_WINDOW = BigInt(
  import.meta.env.VITE_ACCOUNT_HISTORY_BLOCK_WINDOW ?? 20000,
)

import { AppKit } from "@circle-fin/app-kit"
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2"
import { ethers } from "ethers"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseAbiItem,
  type Chain,
} from "viem"

import SendButton from "./components/send/SendButton"
import {
  ACCOUNT_HISTORY_BLOCK_WINDOW,
  ARC_CHAIN,
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_RPC,
  CIRCLE_KIT_KEY,
  EURC_ADDRESS,
  USDC_ADDRESS,
  ZERO_ADDRESS,
} from "./lib/arc"
import { withCircleBrowserFetch } from "./lib/circle"
import {
  ARC_NAME_SERVICE_ABI,
  ARC_NAME_SERVICE_ADDRESS,
  isArcName,
  isValidArcLabel,
  stripArcSuffix,
  toArcName,
} from "./lib/nameService"
import { useWallet } from "./providers/WalletProvider"

import "./App.css"

type Eip1193Provider = {
  request: <T = unknown>(args: { method: string; params?: unknown }) => Promise<T>
  on: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void
}

type TokenSymbol = "USDC" | "EURC"
type OperationMode =
  | "overview"
  | "send"
  | "receive"
  | "swap"
  | "bridge"
  | "cross-chain"
  | "history"
  | "profile"
  | "docs"

type TokenBalance = {
  symbol: TokenSymbol
  balance: string
  fiat: string
}

type ActivityType =
  | "inflow"
  | "outflow"
  | "send"
  | "swap"
  | "bridge"
  | "cross-chain"
  | "name"

type ActivityRow = {
  id: string
  type: ActivityType
  label: string
  meta: string
  amount: string
  token?: TokenSymbol | "USDC"
  status: "confirmed" | "pending"
  direction: "positive" | "negative" | "neutral"
  hash?: string
  explorerUrl?: string
  sortKey: number
}

const kit = new AppKit()
const APP_ACTIVITY_KEY = "blue:app-activity"
const FAUCET_URL = "https://faucet.circle.com"

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
)

const tokenConfig = {
  USDC: {
    symbol: "USDC" as const,
    address: USDC_ADDRESS,
    decimals: 6,
    price: 1,
  },
  EURC: {
    symbol: "EURC" as const,
    address: EURC_ADDRESS,
    decimals: 6,
    price: 1.09,
  },
}

const bridgeDestinations = [
  "Ethereum_Sepolia",
  "Base_Sepolia",
  "Arbitrum_Sepolia",
  "Optimism_Sepolia",
] as const

const navGroups: Array<{
  label: string
  items: Array<{ mode: OperationMode; label: string; badge?: string }>
}> = [
  {
    label: "Main",
    items: [
      { mode: "overview", label: "Dashboard" },
      { mode: "send", label: "Send" },
      { mode: "receive", label: "Receive" },
    ],
  },
  {
    label: "Finance",
    items: [
      { mode: "swap", label: "Swap" },
      { mode: "bridge", label: "Bridge" },
      { mode: "cross-chain", label: "Cross-chain" },
      { mode: "history", label: "History", badge: "Live" },
    ],
  },
  {
    label: "Account",
    items: [
      { mode: "profile", label: "Profile" },
      { mode: "docs", label: "Docs" },
    ],
  },
]

const arcClient = createPublicClient({
  chain: ARC_CHAIN,
  transport: http(ARC_RPC),
})

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function maskAddress(address?: string) {
  if (!address) return "Not connected"
  return `${address.slice(0, 6)} .... .... ${address.slice(-4)}`
}

function trimHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function normalizeError(err: unknown) {
  if (err instanceof Error) return err.message
  return "Transaction failed"
}

function getExplorerUrl(hash?: string) {
  return hash ? `${ARC_EXPLORER_URL}/tx/${hash}` : undefined
}

function extractStepExplorerUrl(result: {
  steps?: Array<{ explorerUrl?: string; txHash?: string; data?: unknown }>
}) {
  const step = result.steps?.find((item) => item.explorerUrl || item.txHash)
  if (step?.explorerUrl) return step.explorerUrl
  if (step?.txHash) return getExplorerUrl(step.txHash) ?? ""

  const dataStep = result.steps?.find(
    (item) =>
      item.data &&
      typeof item.data === "object" &&
      "explorerUrl" in item.data,
  )
  if (
    dataStep?.data &&
    typeof dataStep.data === "object" &&
    "explorerUrl" in dataStep.data &&
    typeof dataStep.data.explorerUrl === "string"
  ) {
    return dataStep.data.explorerUrl
  }

  return ""
}

async function ensureArcNetwork(provider: Eip1193Provider) {
  const chainId = `0x${ARC_CHAIN_ID.toString(16)}`

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    })
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: ARC_CHAIN.name,
          nativeCurrency: ARC_CHAIN.nativeCurrency,
          rpcUrls: [ARC_RPC],
          blockExplorerUrls: [ARC_CHAIN.blockExplorers?.default.url],
        },
      ],
    })
  }
}

function App() {
  const {
    address: walletAddress,
    connect,
    connected,
    disconnect,
    getProvider,
    ready,
  } = useWallet()

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("blue-theme")
    return saved === "light" ? "light" : "dark"
  })
  const [mode, setMode] = useState<OperationMode>("overview")
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [chainActivity, setChainActivity] = useState<ActivityRow[]>([])
  const [appActivity, setAppActivity] = useState<ActivityRow[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(APP_ACTIVITY_KEY) ?? "[]")
    } catch {
      return []
    }
  })
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [operationStatus, setOperationStatus] = useState("")
  const [lastExplorerUrl, setLastExplorerUrl] = useState("")
  const [error, setError] = useState("")

  const [recipient, setRecipient] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [sendToken, setSendToken] = useState<TokenSymbol>("USDC")
  const [swapAmount, setSwapAmount] = useState("1.00")
  const [tokenIn, setTokenIn] = useState<TokenSymbol>("USDC")
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("EURC")
  const [bridgeAmount, setBridgeAmount] = useState("1.00")
  const [bridgeTo, setBridgeTo] =
    useState<(typeof bridgeDestinations)[number]>("Ethereum_Sepolia")
  const [crossAmount, setCrossAmount] = useState("1.00")
  const [crossTokenIn, setCrossTokenIn] = useState<TokenSymbol>("EURC")
  const [arcName, setArcName] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [loadingName, setLoadingName] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const signedIn = ready && connected
  const displayName = arcName || maskAddress(walletAddress) || "Blue user"

  const totalUsd = useMemo(
    () =>
      balances.reduce(
        (total, item) =>
          total + Number(item.balance || 0) * tokenConfig[item.symbol].price,
        0,
      ),
    [balances],
  )

  const flowTotals = useMemo(() => {
    const seen = new Set<string>()

    return [...appActivity, ...chainActivity].reduce(
      (totals, item) => {
        const value = Math.abs(Number(item.amount || 0))
        if (!value) return totals

        const direction =
          item.type === "inflow" || item.direction === "positive"
            ? "inflow"
            : item.type === "outflow" || item.direction === "negative"
              ? "outflow"
              : ""

        if (!direction) return totals

        const key = item.hash
          ? `${item.hash}-${direction}-${item.token ?? ""}`
          : item.id
        if (seen.has(key)) return totals
        seen.add(key)

        totals[direction] += value
        return totals
      },
      { inflow: 0, outflow: 0 },
    )
  }, [appActivity, chainActivity])

  const activity = useMemo(
    () =>
      [...appActivity, ...chainActivity]
        .sort((a, b) => b.sortKey - a.sortKey)
        .slice(0, 14),
    [appActivity, chainActivity],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("blue-theme", theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(APP_ACTIVITY_KEY, JSON.stringify(appActivity.slice(0, 24)))
  }, [appActivity])

  const recordActivity = useCallback(
    (
      entry: Omit<ActivityRow, "id" | "sortKey" | "status"> &
        Partial<Pick<ActivityRow, "status">>,
    ) => {
      const now = Date.now()
      setAppActivity((current) => [
        {
          ...entry,
          id: `app-${now}-${Math.random().toString(16).slice(2)}`,
          sortKey: now,
          status: entry.status ?? "confirmed",
        },
        ...current,
      ])
    },
    [],
  )

  const getAdapter = async () => {
    const provider = await getProvider()
    await ensureArcNetwork(provider)

    return createViemAdapterFromProvider({
      provider,
      getPublicClient: ({ chain }: { chain: Chain }) =>
        createPublicClient({
          chain,
          transport: http(chain.id === ARC_CHAIN_ID ? ARC_RPC : undefined),
        }),
    })
  }

  const resolveRecipient = useCallback(async (value: string) => {
    const normalized = value.trim()

    if (isAddress(normalized)) {
      return normalized as `0x${string}`
    }

    if (!ARC_NAME_SERVICE_ADDRESS) {
      throw new Error("Name service contract is not configured")
    }

    if (!isArcName(normalized)) {
      throw new Error("Enter a valid address or .arc name")
    }

    const label = stripArcSuffix(normalized)
    const resolved = await arcClient.readContract({
      address: ARC_NAME_SERVICE_ADDRESS,
      abi: ARC_NAME_SERVICE_ABI,
      functionName: "addressOf",
      args: [label],
    })

    if (resolved === ZERO_ADDRESS) {
      throw new Error(`${toArcName(label)} is not registered`)
    }

    return resolved
  }, [])

  const fetchArcName = useCallback(async () => {
    if (!walletAddress || !ARC_NAME_SERVICE_ADDRESS) return

    try {
      const name = await arcClient.readContract({
        address: ARC_NAME_SERVICE_ADDRESS,
        abi: ARC_NAME_SERVICE_ABI,
        functionName: "nameOf",
        args: [walletAddress],
      })

      setArcName(name ? toArcName(name) : "")
    } catch (err) {
      console.error(err)
    }
  }, [walletAddress])

  const fetchBalances = useCallback(async () => {
    if (!walletAddress) return

    setLoadingBalances(true)
    setError("")

    try {
      const entries = await Promise.all(
        Object.values(tokenConfig).map(async (token) => {
          const raw = await arcClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress],
          })

          const balance = formatUnits(raw, token.decimals)

          return {
            symbol: token.symbol,
            balance,
            fiat: formatMoney(Number(balance) * token.price),
          }
        }),
      )

      setBalances(entries)
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setLoadingBalances(false)
    }
  }, [walletAddress])

  const fetchHistory = useCallback(async () => {
    if (!walletAddress) return

    try {
      const currentBlock = await arcClient.getBlockNumber()
      const fromBlock =
        currentBlock > ACCOUNT_HISTORY_BLOCK_WINDOW
          ? currentBlock - ACCOUNT_HISTORY_BLOCK_WINDOW
          : 0n

      const rawRows = (
        await Promise.all(
          Object.values(tokenConfig).map(async (token) => {
            const [inflows, outflows] = await Promise.all([
              arcClient.getLogs({
                address: token.address,
                event: transferEvent,
                args: { to: walletAddress },
                fromBlock,
                toBlock: currentBlock,
              }),
              arcClient.getLogs({
                address: token.address,
                event: transferEvent,
                args: { from: walletAddress },
                fromBlock,
                toBlock: currentBlock,
              }),
            ])

            return [
              ...inflows.map((log) => ({
                hash: log.transactionHash,
                type: "inflow" as const,
                label: `Received ${token.symbol}`,
                meta: `Block ${log.blockNumber?.toString() ?? "pending"}`,
                token: token.symbol,
                amount: formatUnits(log.args.value ?? 0n, token.decimals),
                blockNumber: log.blockNumber ?? 0n,
              })),
              ...outflows.map((log) => ({
                hash: log.transactionHash,
                type: "outflow" as const,
                label: `Sent ${token.symbol}`,
                meta: `Block ${log.blockNumber?.toString() ?? "pending"}`,
                token: token.symbol,
                amount: formatUnits(log.args.value ?? 0n, token.decimals),
                blockNumber: log.blockNumber ?? 0n,
              })),
            ]
          }),
        )
      )
        .flat()
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, 24)

      const blockNumbers = [...new Set(rawRows.map((row) => row.blockNumber))]
      const timestamps = new Map<bigint, number>()

      await Promise.all(
        blockNumbers.map(async (blockNumber) => {
          if (blockNumber === 0n) return
          const block = await arcClient.getBlock({ blockNumber })
          timestamps.set(blockNumber, Number(block.timestamp) * 1000)
        }),
      )

      setChainActivity(
        rawRows.map((row) => ({
          id: `${row.hash}-${row.type}-${row.token}`,
          type: row.type,
          label: row.label,
          meta: row.meta,
          token: row.token,
          amount: row.amount,
          status: "confirmed",
          direction: row.type === "inflow" ? "positive" : "negative",
          hash: row.hash,
          explorerUrl: getExplorerUrl(row.hash),
          sortKey: timestamps.get(row.blockNumber) ?? Number(row.blockNumber),
        })),
      )
    } catch (err) {
      console.error(err)
    }
  }, [walletAddress])

  useEffect(() => {
    if (!signedIn || !walletAddress) return

    const refresh = () => {
      void fetchBalances()
      void fetchHistory()
      void fetchArcName()
    }

    refresh()
    const interval = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(interval)
  }, [fetchArcName, fetchBalances, fetchHistory, signedIn, walletAddress])

  const runOperation = async (
    label: string,
    operation: () => Promise<{ explorerUrl: string; hash?: string }>,
  ) => {
    setOperationStatus(label)
    setLastExplorerUrl("")
    setError("")

    try {
      const result = await operation()
      setLastExplorerUrl(result.explorerUrl)
      await fetchBalances()
      await fetchHistory()
      setOperationStatus("Complete")
      return result
    } catch (err) {
      setError(normalizeError(err))
      setOperationStatus("")
      return undefined
    }
  }

  const handleSwap = async () => {
    if (!CIRCLE_KIT_KEY) {
      setError("Missing VITE_CIRCLE_KIT_KEY")
      return
    }

    const result = await runOperation("Waiting for swap signature...", async () => {
      const adapter = await getAdapter()
      const swapResult = await withCircleBrowserFetch(() =>
        kit.swap({
          from: { adapter, chain: "Arc_Testnet" },
          tokenIn,
          tokenOut,
          amountIn: swapAmount,
          config: {
            kitKey: CIRCLE_KIT_KEY,
            slippageBps: 300,
          },
        }),
      )

      return {
        explorerUrl: swapResult.explorerUrl ?? "",
        hash: swapResult.txHash,
      }
    })

    if (result) {
      recordActivity({
        type: "swap",
        label: `${tokenIn} to ${tokenOut}`,
        meta: "Arc swap",
        amount: swapAmount,
        token: tokenIn,
        direction: "neutral",
        hash: result.hash,
        explorerUrl: result.explorerUrl,
      })
    }
  }

  const handleBridge = async () => {
    const result = await runOperation("Bridging USDC...", async () => {
      const adapter = await getAdapter()
      const bridgeResult = await kit.bridge({
        from: { adapter, chain: "Arc_Testnet" },
        to: { adapter, chain: bridgeTo },
        amount: bridgeAmount,
        token: "USDC",
      })

      const hash = bridgeResult.steps.find((step) => step.txHash)?.txHash
      return {
        explorerUrl: extractStepExplorerUrl(bridgeResult),
        hash,
      }
    })

    if (result) {
      recordActivity({
        type: "bridge",
        label: `Bridge to ${bridgeTo}`,
        meta: "Circle CCTP",
        amount: bridgeAmount,
        token: "USDC",
        direction: "negative",
        hash: result.hash,
        explorerUrl: result.explorerUrl,
      })
    }
  }

  const handleCrossChainSwap = async () => {
    if (!CIRCLE_KIT_KEY) {
      setError("Missing VITE_CIRCLE_KIT_KEY")
      return
    }

    const result = await runOperation("Swapping then bridging USDC...", async () => {
      const adapter = await getAdapter()
      const swapResult = await withCircleBrowserFetch(() =>
        kit.swap({
          from: { adapter, chain: "Arc_Testnet" },
          tokenIn: crossTokenIn,
          tokenOut: "USDC",
          amountIn: crossAmount,
          config: {
            kitKey: CIRCLE_KIT_KEY,
            slippageBps: 300,
          },
        }),
      )

      const bridgeResult = await kit.bridge({
        from: { adapter, chain: "Arc_Testnet" },
        to: { adapter, chain: bridgeTo },
        amount: swapResult.amountOut ?? crossAmount,
        token: "USDC",
      })

      const hash =
        bridgeResult.steps.find((step) => step.txHash)?.txHash ??
        swapResult.txHash

      return {
        explorerUrl: extractStepExplorerUrl(bridgeResult) || swapResult.explorerUrl || "",
        hash,
      }
    })

    if (result) {
      recordActivity({
        type: "cross-chain",
        label: `${crossTokenIn} to USDC`,
        meta: `Arc to ${bridgeTo}`,
        amount: crossAmount,
        token: crossTokenIn,
        direction: "neutral",
        hash: result.hash,
        explorerUrl: result.explorerUrl,
      })
    }
  }

  const handleRegisterName = async () => {
    if (!ARC_NAME_SERVICE_ADDRESS) {
      setError("Deploy ArcNameService and set VITE_ARC_NAME_SERVICE_ADDRESS")
      return
    }

    const label = stripArcSuffix(nameInput)

    if (!isValidArcLabel(label)) {
      setError("Use 3-32 lowercase letters, numbers, or hyphens")
      return
    }

    setLoadingName(true)
    setError("")
    setOperationStatus(`Minting ${toArcName(label)}...`)

    try {
      const provider = await getProvider()
      await ensureArcNetwork(provider)
      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(
        ARC_NAME_SERVICE_ADDRESS,
        ARC_NAME_SERVICE_ABI,
        signer,
      )

      const tx = await contract.register(label)
      const receipt = await tx.wait()
      const hash = receipt?.hash ?? tx.hash
      const explorerUrl = getExplorerUrl(hash) ?? ""

      await fetchArcName()
      setNameInput("")
      setOperationStatus("Name minted")
      setLastExplorerUrl(explorerUrl)
      recordActivity({
        type: "name",
        label: `Minted ${toArcName(label)}`,
        meta: "Arc name service",
        amount: "0",
        direction: "neutral",
        hash,
        explorerUrl,
      })
    } catch (err) {
      setError(normalizeError(err))
      setOperationStatus("")
    } finally {
      setLoadingName(false)
    }
  }

  const handleSendSuccess = async (hash?: string) => {
    recordActivity({
      type: "send",
      label: `Sent ${sendToken}`,
      meta: recipient.trim() || "Recipient",
      amount: sendAmount,
      token: sendToken,
      direction: "negative",
      hash,
      explorerUrl: getExplorerUrl(hash),
    })
    await fetchBalances()
    await fetchHistory()
  }

  const copyAddress = async () => {
    if (!walletAddress) return
    await navigator.clipboard?.writeText(walletAddress)
    setOperationStatus("Address copied")
    setProfileOpen(false)
    window.setTimeout(() => setOperationStatus(""), 1400)
  }

  const handleConnect = async () => {
    setError("")

    try {
      await connect()
    } catch (err) {
      setError(normalizeError(err))
    }
  }

  const handleDisconnect = () => {
    setProfileOpen(false)
    disconnect()
  }

  const renderNameCard = () => (
    <section className="card name-card">
      <div className="card-header">
        <div className="card-title">Arc Name</div>
        <a className="card-action" href={FAUCET_URL} target="_blank">
          Faucet
        </a>
      </div>

      <div className="name-display">
        <div className="wallet-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{arcName || "Choose your .arc"}</strong>
          <span>{maskAddress(walletAddress)}</span>
        </div>
      </div>

      {!ARC_NAME_SERVICE_ADDRESS ? (
        <p className="muted compact">
          Add VITE_ARC_NAME_SERVICE_ADDRESS after deploying the name contract.
        </p>
      ) : arcName ? (
        <p className="success-note">Your wallet is mapped to {arcName}.</p>
      ) : (
        <div className="name-form">
          <div className="name-input-row">
            <input
              className="input-field"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="legend"
            />
            <span>.arc</span>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleRegisterName}
            disabled={loadingName}
          >
            {loadingName ? "Minting..." : "Mint .arc name"}
          </button>
        </div>
      )}
    </section>
  )

  const renderSendCard = () => (
    <section className="card action-card tx-action-card">
      <div className="card-head">
        <span className="card-title">Send Stablecoins</span>
        <span className="network-badge">Arc Testnet</span>
      </div>

      <div className="token-box">
        <div className="token-row-top">
          <span className="token-label">Amount</span>
          <span className="token-balance">
            Balance: {balances.find((item) => item.symbol === sendToken)?.balance ?? "0"} {sendToken}
          </span>
        </div>
        <div className="token-row-bottom">
          <input
            className="token-amount"
            value={sendAmount}
            onChange={(event) => setSendAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
          <select
            className="token-select native-select"
            value={sendToken}
            onChange={(event) => setSendToken(event.target.value as TokenSymbol)}
          >
            <option value="USDC">USDC</option>
            <option value="EURC">EURC</option>
          </select>
        </div>
      </div>

      <label className="input-group">
        <span className="input-label">Recipient</span>
        <input
          className="input-field"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="0x... or name.arc"
        />
      </label>
      <div className="fee-block">
        <div className="fee-row">
          <span className="fee-key">Recipient type</span>
          <span className="fee-val">{isArcName(recipient.trim()) ? ".arc name" : "Wallet address"}</span>
        </div>
        <div className="fee-row">
          <span className="fee-key">Asset</span>
          <span className="fee-val green">{sendToken}</span>
        </div>
      </div>
      <SendButton
        recipient={recipient}
        amount={sendAmount}
        token={sendToken}
        resolveRecipient={resolveRecipient}
        onSuccess={handleSendSuccess}
      />
    </section>
  )

  const renderSwapCard = () => (
    <section className="card action-card tx-action-card">
      <div className="card-head">
        <span className="card-title">Swap Tokens</span>
        <span className="network-badge">Arc Testnet</span>
      </div>

      <div className="token-box">
        <div className="token-row-top">
          <span className="token-label">Pay</span>
          <span className="token-balance">
            Balance: {balances.find((item) => item.symbol === tokenIn)?.balance ?? "0"} {tokenIn}
          </span>
        </div>
        <div className="token-row-bottom">
          <input
            className="token-amount"
            value={swapAmount}
            onChange={(event) => setSwapAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
          <select
            className="token-select native-select"
            value={tokenIn}
            onChange={(event) => setTokenIn(event.target.value as TokenSymbol)}
          >
            <option value="USDC">USDC</option>
            <option value="EURC">EURC</option>
          </select>
        </div>
      </div>

      <div className="swap-divider">
        <button
          type="button"
          className="swap-btn"
          onClick={() => {
            setTokenIn(tokenOut)
            setTokenOut(tokenIn)
          }}
          title="Switch tokens"
        >
          V
        </button>
      </div>

      <div className="token-box">
        <div className="token-row-top">
          <span className="token-label">Receive</span>
          <span className="token-balance">
            Balance: {balances.find((item) => item.symbol === tokenOut)?.balance ?? "0"} {tokenOut}
          </span>
        </div>
        <div className="token-row-bottom">
          <input
            className="token-amount estimated"
            value=""
            readOnly
            placeholder="Estimated"
          />
          <select
            className="token-select native-select"
            value={tokenOut}
            onChange={(event) => setTokenOut(event.target.value as TokenSymbol)}
          >
            <option value="EURC">EURC</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
      </div>

      <div className="fee-block">
        <div className="fee-row">
          <span className="fee-key">Slippage</span>
          <span className="fee-val">3.00%</span>
        </div>
        <div className="fee-row">
          <span className="fee-key">Provider</span>
          <span className="fee-val green">Circle App Kit</span>
        </div>
      </div>

      <button type="button" className="btn-primary cta" onClick={handleSwap}>
        Swap on Arc
      </button>
    </section>
  )

  const renderBridgeCard = () => (
    <section className="card action-card tx-action-card">
      <div className="card-head">
        <span className="card-title">Bridge USDC</span>
        <span className="network-badge">CCTP</span>
      </div>

      <div className="token-box">
        <div className="token-row-top">
          <span className="token-label">From Arc</span>
          <span className="token-balance">
            Balance: {balances.find((item) => item.symbol === "USDC")?.balance ?? "0"} USDC
          </span>
        </div>
        <div className="token-row-bottom">
          <input
            className="token-amount"
            value={bridgeAmount}
            onChange={(event) => setBridgeAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
          <div className="token-select">
            <div className="token-icon ti-usdc">$</div>
            <span className="token-sym">USDC</span>
          </div>
        </div>
      </div>

      <label className="input-group bridge-destination">
        <span className="input-label">Destination</span>
          <select
            className="input-field"
            value={bridgeTo}
            onChange={(event) =>
              setBridgeTo(event.target.value as (typeof bridgeDestinations)[number])
            }
          >
            {bridgeDestinations.map((chain) => (
              <option value={chain} key={chain}>
                {chain}
              </option>
            ))}
          </select>
      </label>

      <div className="fee-block">
        <div className="fee-row">
          <span className="fee-key">Transfer protocol</span>
          <span className="fee-val green">Circle CCTP</span>
        </div>
        <div className="fee-row">
          <span className="fee-key">Source chain</span>
          <span className="fee-val">Arc Testnet</span>
        </div>
      </div>

      <button type="button" className="btn-primary cta" onClick={handleBridge}>
        Bridge from Arc
      </button>
    </section>
  )

  const renderCrossChainCard = () => (
    <section className="card action-card tx-action-card">
      <div className="card-head">
        <span className="card-title">Swap and Bridge</span>
        <span className="network-badge">Arc Route</span>
      </div>

      <div className="token-box">
        <div className="token-row-top">
          <span className="token-label">Pay on Arc</span>
          <span className="token-balance">
            Balance: {balances.find((item) => item.symbol === crossTokenIn)?.balance ?? "0"} {crossTokenIn}
          </span>
        </div>
        <div className="token-row-bottom">
          <input
            className="token-amount"
            value={crossAmount}
            onChange={(event) => setCrossAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
          <select
            className="token-select native-select"
            value={crossTokenIn}
            onChange={(event) => setCrossTokenIn(event.target.value as TokenSymbol)}
          >
            <option value="EURC">EURC to USDC</option>
            <option value="USDC">USDC to USDC</option>
          </select>
        </div>
      </div>

      <label className="input-group">
        <span className="input-label">Destination</span>
        <select
          className="input-field"
          value={bridgeTo}
          onChange={(event) =>
            setBridgeTo(event.target.value as (typeof bridgeDestinations)[number])
          }
        >
          {bridgeDestinations.map((chain) => (
            <option value={chain} key={chain}>
              {chain}
            </option>
          ))}
        </select>
      </label>

      <div className="fee-block">
        <div className="fee-row">
          <span className="fee-key">Route</span>
          <span className="fee-val">{crossTokenIn} to USDC</span>
        </div>
        <div className="fee-row">
          <span className="fee-key">Destination token</span>
          <span className="fee-val green">USDC</span>
        </div>
      </div>

      <button type="button" className="btn-primary cta" onClick={handleCrossChainSwap}>
        Execute route
      </button>
    </section>
  )

  const renderActivityCard = (limit?: number) => (
    <section className="card activity-card">
      <div className="card-header">
        <div className="card-title">Real-time Activity</div>
        <button type="button" className="card-action button-reset" onClick={fetchHistory}>
          Refresh
        </button>
      </div>

      <div className="flow-strip">
        <div>
          <span>Inflow</span>
          <strong className="positive">{flowTotals.inflow.toFixed(4)}</strong>
        </div>
        <div>
          <span>Outflow</span>
          <strong className="negative">{flowTotals.outflow.toFixed(4)}</strong>
        </div>
        <div>
          <span>Net</span>
          <strong>{(flowTotals.inflow - flowTotals.outflow).toFixed(4)}</strong>
        </div>
      </div>

      <div className="tx-list">
        {activity.length === 0 ? (
          <p className="muted compact">No onchain activity found yet.</p>
        ) : (
          activity.slice(0, limit).map((item) => {
            const content = (
              <>
                <div className={`tx-icon ${item.type}`}>{item.type.slice(0, 1).toUpperCase()}</div>
                <div className="tx-info">
                  <div className="tx-type">{item.label}</div>
                  <div className="tx-meta">
                    {item.hash ? trimHash(item.hash) : item.meta} | {item.meta}
                  </div>
                </div>
                <div className="tx-amount">
                  <div className={`tx-amount-val ${item.direction}`}>
                    {item.direction === "positive"
                      ? "+"
                      : item.direction === "negative"
                        ? "-"
                        : ""}
                    {Number(item.amount) > 0 ? Number(item.amount).toFixed(4) : ""}
                    {item.token ? ` ${item.token}` : ""}
                  </div>
                  <span className={`tx-status ${item.status}`}>{item.status}</span>
                </div>
              </>
            )

            return item.explorerUrl ? (
              <a className="tx-item" href={item.explorerUrl} target="_blank" key={item.id}>
                {content}
              </a>
            ) : (
              <div className="tx-item" key={item.id}>
                {content}
              </div>
            )
          })
        )}
      </div>
    </section>
  )

  const renderDocsPage = () => (
    <section className="docs-page">
      <div className="docs-hero card">
        <div className="docs-kicker">Blue Docs</div>
        <h1>Stablecoin finance on Arc Network.</h1>
        <p>
          Blue is a stablecoin-native fintech dApp for sending, receiving,
          swapping, bridging, and managing USDC and EURC through a simple
          onchain interface.
        </p>
        <div className="docs-actions">
          <button type="button" className="btn-primary" onClick={() => setMode("overview")}>
            Open app
          </button>
          <a
            className="qbtn"
            href="https://github.com/Laegend14/blue"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>

      <div className="docs-strip">
        <div>
          <strong>Arc Testnet</strong>
          <span>Chain ID 5042002</span>
        </div>
        <div>
          <strong>Circle App Kit</strong>
          <span>Swaps and CCTP bridge</span>
        </div>
        <div>
          <strong>.arc Names</strong>
          <span>Human-readable wallet identity</span>
        </div>
      </div>

      <div className="docs-grid">
        <article className="doc-card">
          <span>01</span>
          <h2>Send and Receive</h2>
          <p>
            Transfer USDC or EURC to wallet addresses or registered .arc names.
            The receive view exposes the wallet address and faucet path for
            funding.
          </p>
        </article>
        <article className="doc-card">
          <span>02</span>
          <h2>Stablecoin Swaps</h2>
          <p>
            Swap USDC and EURC on Arc using Circle App Kit with signed wallet
            transactions and real explorer links after completion.
          </p>
        </article>
        <article className="doc-card">
          <span>03</span>
          <h2>Bridge and Routes</h2>
          <p>
            Bridge USDC through CCTP, or swap into USDC first and then bridge
            to supported destination testnets.
          </p>
        </article>
        <article className="doc-card">
          <span>04</span>
          <h2>Arc Name Service</h2>
          <p>
            Users can mint a permanent .arc name after they fund their wallet,
            then use that identity instead of long addresses across the app.
          </p>
        </article>
      </div>

      <section className="card docs-stack">
        <div className="card-title">Technology Stack</div>
        <div className="stack-list">
          <span>External Web3 wallet</span>
          <span>Arc Network</span>
          <span>Circle App Kit</span>
          <span>Viem and Ethers</span>
          <span>USDC and EURC</span>
          <span>Vercel deployment</span>
        </div>
      </section>
    </section>
  )

  const renderMainContent = () => {
    if (!signedIn) {
      return (
        <section className="signed-out">
          <img src="/blue-logo.png" alt="Blue" />
          <div>
            <p className="balance-label">Blue on Arc Network</p>
            <h1>Your USDC and EURC command center.</h1>
            <p>
              Connect your Web3 wallet to send, receive, swap, bridge, and mint your
              permanent .arc name.
            </p>
            <button type="button" className="btn-primary" onClick={() => void handleConnect()}>
              Connect wallet
            </button>
          </div>
        </section>
      )
    }

    if (mode === "send") {
      return (
        <div className="focus-grid">
          {renderSendCard()}
          {renderNameCard()}
        </div>
      )
    }

    if (mode === "receive") {
      return (
        <div className="focus-grid">
          <section className="card receive-card">
            <div className="card-header">
              <div className="card-title">Receive</div>
              <a className="card-action" href={FAUCET_URL} target="_blank">
                Faucet
              </a>
            </div>
            <div className="receive-address">
              <strong>{arcName || "Wallet address"}</strong>
              <span>{walletAddress}</span>
            </div>
            <button type="button" className="btn-primary" onClick={copyAddress}>
              Copy address
            </button>
          </section>
          {renderNameCard()}
        </div>
      )
    }

    if (mode === "swap") return <div className="focus-grid">{renderSwapCard()}{renderActivityCard(6)}</div>
    if (mode === "bridge") return <div className="focus-grid">{renderBridgeCard()}{renderActivityCard(6)}</div>
    if (mode === "cross-chain") return <div className="focus-grid">{renderCrossChainCard()}{renderActivityCard(6)}</div>
    if (mode === "history") return <div className="single-column">{renderActivityCard()}</div>
    if (mode === "docs") return renderDocsPage()

    if (mode === "profile") {
      return (
        <div className="grid-2">
          {renderNameCard()}
          <section className="card settings-card">
            <div className="card-header">
              <div className="card-title">Settings</div>
            </div>
            <button
              type="button"
              className="settings-row"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <span className="settings-icon">T</span>
              <span>
                <strong>Theme</strong>
                <small>{theme === "dark" ? "Dark" : "Light"}</small>
              </span>
              <span className={`toggle ${theme === "dark" ? "on" : ""}`} />
            </button>
            <button type="button" className="settings-row" onClick={disconnect}>
              <span className="settings-icon">L</span>
              <span>
                <strong>Disconnect</strong>
                <small>Disconnect this wallet from Blue</small>
              </span>
            </button>
          </section>
        </div>
      )
    }

    return (
      <>
        <section className="balance-hero">
          <div className="balance-left">
            <p className="balance-label">Total Arc Balance</p>
            <div className="balance-amount">
              {loadingBalances ? "Loading" : formatMoney(totalUsd)}
              <span className="balance-currency">USD</span>
            </div>
            <div className="hero-actions">
              <button type="button" className="qbtn primary" onClick={() => setMode("send")}>
                Send
              </button>
              <button type="button" className="qbtn" onClick={() => setMode("swap")}>
                Swap
              </button>
              <button type="button" className="qbtn" onClick={() => setMode("bridge")}>
                Bridge
              </button>
              <button type="button" className="qbtn" onClick={() => setMode("cross-chain")}>
                Route
              </button>
              <a className="qbtn" href={FAUCET_URL} target="_blank">
                Faucet
              </a>
            </div>
          </div>
          <div className="balance-tokens">
            {balances.map((item) => (
              <div className="token-card" key={item.symbol}>
                <div className={`token-icon ${item.symbol.toLowerCase()}`}>
                  {item.symbol.slice(0, 1)}
                </div>
                <div className="token-info">
                  <div className="token-name">{item.symbol}</div>
                  <div className="token-amount">{Number(item.balance).toFixed(4)}</div>
                  <div className="token-value">{item.fiat}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid-2 dashboard-grid">
          {renderNameCard()}
          {renderActivityCard(6)}
        </div>
      </>
    )
  }

  return (
    <main className="blue-app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img className="logo-mark" src="/blue-logo.png" alt="Blue" />
          <div>
            <div className="logo-text">Blue</div>
            <div className="logo-sub">Arc Network</div>
          </div>
        </div>

        <nav>
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-section-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  type="button"
                  className={mode === item.mode ? "nav-item active" : "nav-item"}
                  onClick={() => setMode(item.mode)}
                  key={item.mode}
                >
                  <span className="nav-icon">{item.label.slice(0, 1)}</span>
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="network-pill">
            <span className="network-dot" />
            Arc Testnet
          </div>
          {signedIn && (
            <button type="button" className="nav-item logout-item" onClick={handleDisconnect}>
              <span className="nav-icon">L</span>
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </aside>

      <section className="main">
        <header className="app-topbar">
          <div className="welcome-block">
            <span className="welcome-greeting">
              {signedIn ? "Welcome back" : "Welcome to Blue"}
            </span>
            <strong className="welcome-name">
              {signedIn ? displayName : "Connect wallet to continue"}
            </strong>
          </div>

          <div className="topbar-right">
            {operationStatus && <span className="status-pill">{operationStatus}</span>}
            {lastExplorerUrl && (
              <a className="icon-btn text" href={lastExplorerUrl} target="_blank">
                Tx
              </a>
            )}
            <a
              className="icon-btn text"
              href="https://github.com/Laegend14/blue"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? "D" : "L"}
            </button>
            {signedIn ? (
              <div className="profile-menu-wrap">
                <button
                  type="button"
                  className="wallet-chip"
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-expanded={profileOpen}
                >
                  <span className="wallet-avatar">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{arcName || "Wallet"}</strong>
                    <small>{maskAddress(walletAddress)}</small>
                  </span>
                </button>
                {profileOpen && (
                  <div className="profile-menu">
                    <div className="profile-menu-head">
                      <strong>{displayName}</strong>
                      <span>{maskAddress(walletAddress)}</span>
                    </div>
                    <button type="button" onClick={copyAddress}>
                      Copy wallet address
                    </button>
                    <button type="button" onClick={() => {
                      setProfileOpen(false)
                      setMode("profile")
                    }}>
                      View profile
                    </button>
                    <button type="button" onClick={handleDisconnect}>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" className="wallet-chip" onClick={() => void handleConnect()}>
                Connect wallet
              </button>
            )}
          </div>
        </header>

        <div className="page-content">
          {error && <div className="error-banner">{error}</div>}
          {renderMainContent()}
        </div>
      </section>
    </main>
  )
}

export default App

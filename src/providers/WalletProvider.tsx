import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Eip1193Provider = {
  request: <T = unknown>(args: {
    method: string
    params?: unknown
  }) => Promise<T>
  on: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

type WalletContextValue = {
  address?: `0x${string}`
  connected: boolean
  ready: boolean
  connect: () => Promise<void>
  disconnect: () => void
  getProvider: () => Eip1193Provider
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

function getInjectedProvider() {
  if (!window.ethereum) {
    throw new Error("No external Web3 wallet found. Install a browser wallet first.")
  }

  return window.ethereum
}

function firstAddress(accounts: unknown) {
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") return undefined
  return accounts[0] as `0x${string}`
}

export default function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}`>()
  const [ready, setReady] = useState(false)

  const connect = useCallback(async () => {
    const provider = getInjectedProvider()
    const accounts = await provider.request<string[]>({
      method: "eth_requestAccounts",
    })
    setAddress(firstAddress(accounts))
  }, [])

  const disconnect = useCallback(() => {
    setAddress(undefined)
  }, [])

  const getProvider = useCallback(() => getInjectedProvider(), [])

  useEffect(() => {
    if (!window.ethereum) {
      setReady(true)
      return
    }

    const provider = window.ethereum
    const handleAccountsChanged = (...args: unknown[]) => {
      setAddress(firstAddress(args[0]))
    }

    const handleDisconnect = () => setAddress(undefined)

    provider.on("accountsChanged", handleAccountsChanged)
    provider.on("disconnect", handleDisconnect)

    void provider
      .request<string[]>({ method: "eth_accounts" })
      .then((accounts) => setAddress(firstAddress(accounts)))
      .finally(() => setReady(true))

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged)
      provider.removeListener("disconnect", handleDisconnect)
    }
  }, [])

  const value = useMemo(
    () => ({
      address,
      connected: Boolean(address),
      ready,
      connect,
      disconnect,
      getProvider,
    }),
    [address, connect, disconnect, getProvider, ready],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)

  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider")
  }

  return context
}

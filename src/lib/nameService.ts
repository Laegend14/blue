export const ARC_NAME_SERVICE_ADDRESS = import.meta.env
  .VITE_ARC_NAME_SERVICE_ADDRESS as `0x${string}` | undefined

export const ARC_NAME_SERVICE_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "label", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addressOf",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "nameOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "available",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

const arcNamePattern = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?\.arc$/
const labelPattern = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

export function normalizeArcNameInput(value: string) {
  return value.trim().toLowerCase()
}

export function stripArcSuffix(value: string) {
  const normalized = normalizeArcNameInput(value)
  return normalized.endsWith(".arc") ? normalized.slice(0, -4) : normalized
}

export function toArcName(label: string) {
  return `${stripArcSuffix(label)}.arc`
}

export function isArcName(value: string) {
  return arcNamePattern.test(normalizeArcNameInput(value))
}

export function isValidArcLabel(value: string) {
  return labelPattern.test(stripArcSuffix(value))
}

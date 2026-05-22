const CIRCLE_API_HOST = "api.circle.com"

export function normalizeCircleKitKey(kitKey?: string) {
  const trimmed = kitKey?.trim()
  if (!trimmed) return undefined

  return trimmed.startsWith("KIT_KEY:") ? trimmed : `KIT_KEY:${trimmed}`
}

function isCircleApiRequest(input: RequestInfo | URL) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  try {
    return new URL(url).host === CIRCLE_API_HOST
  } catch {
    return false
  }
}

function removeUnsupportedCircleCorsHeader(headers: HeadersInit | undefined) {
  if (!headers) return headers

  const next = new Headers(headers)
  next.delete("X-User-Agent")
  next.delete("x-user-agent")

  return next
}

export async function withCircleBrowserFetch<T>(operation: () => Promise<T>) {
  if (typeof window === "undefined") return operation()

  const originalFetch = window.fetch.bind(window)

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isCircleApiRequest(input)) {
      return originalFetch(input, init)
    }

    const patchedInit = {
      ...init,
      headers: removeUnsupportedCircleCorsHeader(init?.headers),
    }

    return originalFetch(input, patchedInit)
  }) as typeof window.fetch

  try {
    return await operation()
  } finally {
    window.fetch = originalFetch
  }
}

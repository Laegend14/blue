type AssetSelectorProps = {
  asset: string
  onChange: (value: string) => void
}

const assets = ['ETH', 'BTC', 'USDC']

export default function AssetSelector({ asset, onChange }: AssetSelectorProps) {
  return (
    <label className="asset-selector">
      <span>Asset</span>
      <select value={asset} onChange={(event) => onChange(event.target.value)}>
        {assets.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

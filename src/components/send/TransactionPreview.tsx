type TransactionPreviewProps = {
  amount: string
}

export default function TransactionPreview({ amount }: TransactionPreviewProps) {
  const total = amount ? Number(amount) : 0

  return (
    <div className="bg-zinc-800 p-3 rounded-xl mb-4 text-sm">
      <div className="flex justify-between">
        <span>Network fee</span>
        <span>Shown in wallet</span>
      </div>

      <div className="flex justify-between font-semibold mt-2">
        <span>Transfer amount</span>
        <span>{total.toFixed(6)} USDC</span>
      </div>
    </div>
  )
}

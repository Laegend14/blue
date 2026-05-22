type AmountInputProps = {
  value: string
  onChange: (value: string) => void
}

export default function AmountInput({ value, onChange }: AmountInputProps) {
  return (
    <div className="mb-4">
      <label className="text-sm text-gray-400">Amount</label>
      <input
        type="number"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full mt-1 p-3 rounded-xl bg-zinc-800 text-white text-lg outline-none"
      />
    </div>
  );
}

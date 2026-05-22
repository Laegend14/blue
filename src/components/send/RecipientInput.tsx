type RecipientInputProps = {
  value: string
  onChange: (value: string) => void
}

export default function RecipientInput({
  value,
  onChange,
}: RecipientInputProps) {
  return (
    <div className="mb-4">
      <label className="text-sm text-gray-400">Recipient</label>
      <input
        type="text"
        placeholder="0x... or username"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full mt-1 p-3 rounded-xl bg-zinc-800 text-white outline-none"
      />
    </div>
  );
}

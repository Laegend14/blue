import { useState } from "react";
import AmountInput from "./AmountInput";
import RecipientInput from "./RecipientInput";
import TransactionPreview from "./TransactionPreview";
import SendButton from "./SendButton";

export default function SendModal() {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [token, setToken] = useState<"USDC" | "EURC">("USDC");

  return (
    <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4">Send</h2>

      <select value={token} onChange={(event) => setToken(event.target.value as "USDC" | "EURC")}>
        <option value="USDC">USDC</option>
        <option value="EURC">EURC</option>
      </select>

      <AmountInput value={amount} onChange={setAmount} />
      <RecipientInput value={recipient} onChange={setRecipient} />

      <TransactionPreview amount={amount} />

      <SendButton amount={amount} recipient={recipient} token={token} />
    </div>
  );
}

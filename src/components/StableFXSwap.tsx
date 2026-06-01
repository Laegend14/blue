import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../providers/WalletProvider";

import {
  FX_ESCROW_ABI,
  FX_ESCROW_ADDRESS,
  USDC_ADDRESS,
} from "../lib/stablefx";

type Props = {
  amount: string;
};

export default function StableFXSwap1({ amount }: Props) {
  const { connected, getProvider } = useWallet();

  const [loading, setLoading] = useState(false);

  const handleSwap = async () => {
    try {
      if (!connected) {
        alert("No wallet connected");
        return;
      }

      if (!amount || Number(amount) <= 0) {
        alert("Invalid amount");
        return;
      }

      setLoading(true);

      const ethereumProvider = getProvider();

      const provider = new ethers.BrowserProvider(ethereumProvider);

      const signer = await provider.getSigner();

      const escrow = new ethers.Contract(
        FX_ESCROW_ADDRESS,
        FX_ESCROW_ABI,
        signer
      );

      const parsedAmount = ethers.parseUnits(amount, 6);

      // REAL Arc StableFX escrow interaction
      const tx = await escrow.deposit(
        USDC_ADDRESS,
        parsedAmount
      );

      console.log("Swap TX:", tx.hash);

      await tx.wait();

      alert("✅ StableFX deposit completed");
    } catch (err) {
      console.error(err);
      alert("❌ StableFX swap failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSwap}
      disabled={loading}
      className="w-full bg-green-600 p-3 rounded-xl"
    >
      {loading ? "Swapping..." : "Swap via StableFX"}
    </button>
  );
}

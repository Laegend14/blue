import { useState } from "react";
import { ethers } from "ethers";
import { useWallets } from "@privy-io/react-auth";

import {
  ERC20_ABI,
  FX_ESCROW_ADDRESS,
  USDC_ADDRESS,
  EURC_ADDRESS,
} from "../lib/stablefx";

type Props = {
  amount: string;
  token: "USDC" | "EURC";
};

export default function ApproveButton({
  amount,
  token,
}: Props) {
  const { wallets } = useWallets();

  const [loading, setLoading] = useState(false);

  const tokenAddress =
    token === "USDC"
      ? USDC_ADDRESS
      : EURC_ADDRESS;

  const handleApprove = async () => {
    try {
      if (!wallets.length) {
        alert("No wallet connected");
        return;
      }

      setLoading(true);

      const wallet = wallets[0];

      const ethereumProvider =
        await wallet.getEthereumProvider();

      const provider =
        new ethers.BrowserProvider(ethereumProvider);

      const signer = await provider.getSigner();

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        signer
      );

      const parsedAmount =
        ethers.parseUnits(amount, 6);

      const tx = await tokenContract.approve(
        FX_ESCROW_ADDRESS,
        parsedAmount
      );

      await tx.wait();

      alert(`✅ ${token} approved`);
    } catch (err) {
      console.error(err);
      alert("❌ Approval failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="w-full bg-purple-600 p-3 rounded-xl"
    >
      {loading
        ? `Approving ${token}...`
        : `Approve ${token}`}
    </button>
  );
}
import { useWallets } from "@privy-io/react-auth"
import { ethers } from "ethers"

import { EURC_ADDRESS, USDC_ADDRESS } from "../../lib/arc"
import { ERC20_ABI } from "../../lib/contracts"

type Props = {
  recipient: string
  amount: string
  token: "USDC" | "EURC"
  resolveRecipient?: (value: string) => Promise<`0x${string}`>
  onSuccess?: (txHash?: string) => Promise<void> | void
}

export default function SendButton({
  recipient,
  amount,
  token,
  resolveRecipient,
  onSuccess,
}: Props) {
  const { wallets } = useWallets()

  const handleSend = async () => {
    try {
      if (!wallets.length) {
        alert("Connect wallet first")
        return
      }

      if (!amount || Number(amount) <= 0) {
        alert("Enter a valid amount")
        return
      }

      const recipientAddress = resolveRecipient
        ? await resolveRecipient(recipient)
        : (recipient as `0x${string}`)

      const wallet = wallets[0]
      const provider = await wallet.getEthereumProvider()
      const ethersProvider = new ethers.BrowserProvider(provider)
      const signer = await ethersProvider.getSigner()

      const tokenAddress = token === "USDC" ? USDC_ADDRESS : EURC_ADDRESS
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
      const tx = await contract.transfer(
        recipientAddress,
        ethers.parseUnits(amount, 6),
      )

      await tx.wait()
      await onSuccess?.(tx.hash)

      alert(`${token} sent successfully`)
    } catch (err) {
      console.error(err)
      alert("Send failed")
    }
  }

  return (
    <button onClick={handleSend} className="btn-primary">
      Send {token}
    </button>
  )
}

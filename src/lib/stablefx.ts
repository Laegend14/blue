export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`;

export const EURC_ADDRESS = import.meta.env.VITE_EURC_ADDRESS as `0x${string}`;

export const FX_ESCROW_ADDRESS =
  import.meta.env.VITE_STABLEFX_ESCROW_ADDRESS as `0x${string}`;

export const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function allowance(address owner,address spender) external view returns(uint256)",
  "function balanceOf(address owner) external view returns(uint256)",
  "function transfer(address to,uint256 amount) external returns(bool)",
  "function decimals() external view returns(uint8)",
  "function symbol() external view returns(string)"
];

export const FX_ESCROW_ABI = [
  "function deposit(address token,uint256 amount) external",
];

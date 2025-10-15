'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';

const queryClient = new QueryClient();

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

export const sophonTestnet = defineChain({
  id: 531050204,
  name: 'Sophon Testnet',
  nativeCurrency: { name: 'SOPH', symbol: 'SOPH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zksync-os-testnet-sophon.zksync.dev'] },
  },
  blockExplorers: {
    default: {
      name: 'Sophon Explorer',
      url: 'https://block-explorer.zksync-os-testnet-sophon.zksync.dev',
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'Smart Account Demo',
  projectId,
  chains: [sepolia, sophonTestnet],
  ssr: true,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

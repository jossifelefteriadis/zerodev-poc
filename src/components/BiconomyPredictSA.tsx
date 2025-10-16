'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { http } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import {
  toMultichainNexusAccount,
  getMEEVersion,
  MEEVersion,
} from '@biconomy/abstractjs';

export default function BiconomyPredictSA() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ account: eoaAddress });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saAddress, setSaAddress] = useState<`0x${string}` | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const activeChain = walletClient?.chain ?? null;

  const transport = useMemo(() => {
    if (!activeChain) return null;

    const id = activeChain.id;
    const envKey = `NEXT_PUBLIC_RPC_${id}`;
    const envRpcSpecific = (process as any)?.env?.[envKey] as
      | string
      | undefined;

    const sophonEnv =
      id === 531050204
        ? ((process as any)?.env?.NEXT_PUBLIC_SOPHON_RPC as string | undefined)
        : undefined;

    const FALLBACKS: Record<number, string> = {
      11155420:
        (process as any)?.env?.NEXT_PUBLIC_OPSP_RPC ??
        'https://sepolia.optimism.io',
      531050204: 'https://zksync-os-testnet-sophon.zksync.dev',
    };

    const rpc = envRpcSpecific ?? sophonEnv ?? FALLBACKS[id];
    return rpc ? http(rpc) : null;
  }, [activeChain]);

  const explorerBase =
    activeChain?.blockExplorers?.default?.url?.replace(/\/+$/, '') ?? null;

  async function predictCurrentChainSA() {
    try {
      setBusy(true);
      setError(null);
      setSaAddress(null);
      setDebugInfo(null);

      if (!isConnected || !walletClient?.account) {
        throw new Error('Connect a wallet first.');
      }
      if (!activeChain) {
        throw new Error('Could not detect the active chain from the wallet.');
      }
      if (!transport) {
        const hint =
          activeChain.id === 531050204
            ? 'Set NEXT_PUBLIC_SOPHON_RPC or NEXT_PUBLIC_RPC_531050204 to a valid RPC URL.'
            : `Set NEXT_PUBLIC_RPC_${activeChain.id} to a valid RPC URL.`;
        throw new Error(`No RPC transport configured. ${hint}`);
      }

      const orchestrator: any = await toMultichainNexusAccount({
        signer: walletClient,
        chainConfigurations: [
          {
            chain: activeChain as any,
            transport,
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        transports: {
          [activeChain.id]: transport,
        },
      });

      let predicted: `0x${string}` | undefined;
      const tried: string[] = [];

      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn(chainObject)');
          predicted = await orchestrator.addressOn(activeChain);
        } catch {}
      }
      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn({ chain })');
          predicted = await orchestrator.addressOn({ chain: activeChain });
        } catch {}
      }
      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn(chainId)');
          predicted = await orchestrator.addressOn(activeChain.id);
        } catch {}
      }
      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn({ chainId })');
          predicted = await orchestrator.addressOn({ chainId: activeChain.id });
        } catch {}
      }

      if (!predicted && typeof orchestrator.deploymentOn === 'function') {
        try {
          tried.push('deploymentOn(chainObject)');
          const dep = await orchestrator.deploymentOn(activeChain);
          const addr =
            dep?.address || dep?.smartAccountAddress || dep?.predictedAddress;
          if (addr) predicted = addr as `0x${string}`;
        } catch {}
      }
      if (!predicted && typeof orchestrator.deploymentOn === 'function') {
        try {
          tried.push('deploymentOn(chainId)');
          const dep = await orchestrator.deploymentOn(activeChain.id);
          const addr =
            dep?.address || dep?.smartAccountAddress || dep?.predictedAddress;
          if (addr) predicted = addr as `0x${string}`;
        } catch {}
      }

      if (!predicted && orchestrator.deployments) {
        tried.push('deployments map lookup');
        const dep =
          orchestrator.deployments[activeChain.id] ??
          orchestrator.deployments[String(activeChain.id)];
        const addr =
          dep?.address || dep?.smartAccountAddress || dep?.predictedAddress;
        if (addr) predicted = addr as `0x${string}`;
      }

      if (!predicted) {
        setDebugInfo({
          eoa: walletClient.account.address,
          chainId: activeChain.id,
          chainName: activeChain.name,
          orchestratorKeys: Object.keys(orchestrator ?? {}),
          triedResolvers: tried,
        });
        throw new Error(
          'Could not resolve Smart Account address on the current chain with suite v2.1.0. Ensure v2.1.0 MEE/Nexus is live on this chain and your RPC/env are correct.'
        );
      }

      setSaAddress(predicted);
      setDebugInfo({
        eoa: walletClient.account.address,
        chainId: activeChain.id,
        chainName: activeChain.name,
        explorer: explorerBase,
        usedVersion: 'V2_1_0',
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const disabled = !isConnected || !walletClient || busy;

  return (
    <section className='w-full flex justify-center px-4'>
      <section className='w-1/2 flex flex-col justify-center items-center'>
        <ConnectButton showBalance={false} />
        {isConnected && (
          <section className='flex flex-col mt-4'>
            <p className='text-sm opacity-80'>Connected: {eoaAddress}</p>
            <button
              onClick={predictCurrentChainSA}
              disabled={disabled}
              className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer'
            >
              {busy ? 'Working…' : 'Predict Smart Account'}
            </button>
          </section>
        )}

        <section className='mt-4 space-y-2 text-sm'>
          {error && (
            <p className='text-red-400'>
              <b>Error:</b> {error}
            </p>
          )}

          {saAddress && (
            <p>
              <b>Predicted Smart Account:</b>{' '}
              {explorerBase ? (
                <a
                  href={`${explorerBase}/address/${saAddress}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  {saAddress}
                </a>
              ) : (
                saAddress
              )}
            </p>
          )}
        </section>
      </section>
    </section>
  );
}

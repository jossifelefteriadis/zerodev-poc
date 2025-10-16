'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { http } from 'viem';
import { optimism } from 'viem/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import {
  toMultichainNexusAccount,
  createMeeClient,
  getMEEVersion,
  MEEVersion,
} from '@biconomy/abstractjs';

export default function BiconomyPredictSA() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ account: eoaAddress });

  const OPSP_RPC = process.env.NEXT_PUBLIC_OPSP_RPC;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saAddress, setSaAddress] = useState<`0x${string}` | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const opMainnetTransport = useMemo(() => http(OPSP_RPC), [OPSP_RPC]);

  async function createBiconomySA() {
    try {
      setBusy(true);
      setError(null);
      setSaAddress(null);
      setDebugInfo(null);

      if (!isConnected || !walletClient?.account) {
        throw new Error('Connect a wallet first.');
      }
      if (!OPSP_RPC) {
        throw new Error('NEXT_PUBLIC_OPSP_RPC is not set.');
      }

      const orchestrator: any = await toMultichainNexusAccount({
        signer: walletClient,
        chainConfigurations: [
          {
            chain: optimism,
            transport: opMainnetTransport,
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        transports: {
          [optimism.id]: opMainnetTransport,
        },
      });

      await createMeeClient({ account: orchestrator });

      let predicted: `0x${string}` | undefined;
      const tried: string[] = [];

      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn(chainObject)');
          predicted = await orchestrator.addressOn(optimism);
        } catch {}
      }
      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn({ chain })');
          predicted = await orchestrator.addressOn({ chain: optimism });
        } catch {}
      }
      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn(chainId)');
          predicted = await orchestrator.addressOn(optimism.id);
        } catch {}
      }
      if (!predicted && typeof orchestrator.addressOn === 'function') {
        try {
          tried.push('addressOn({ chainId })');
          predicted = await orchestrator.addressOn({ chainId: optimism.id });
        } catch {}
      }

      if (!predicted && typeof orchestrator.deploymentOn === 'function') {
        try {
          tried.push('deploymentOn(chainObject)');
          const dep = await orchestrator.deploymentOn(optimism);
          const addr =
            dep?.address || dep?.smartAccountAddress || dep?.predictedAddress;
          if (addr) predicted = addr as `0x${string}`;
        } catch {}
      }
      if (!predicted && typeof orchestrator.deploymentOn === 'function') {
        try {
          tried.push('deploymentOn(chainId)');
          const dep = await orchestrator.deploymentOn(optimism.id);
          const addr =
            dep?.address || dep?.smartAccountAddress || dep?.predictedAddress;
          if (addr) predicted = addr as `0x${string}`;
        } catch {}
      }

      if (!predicted && orchestrator.deployments) {
        tried.push('deployments map lookup');
        const dep =
          orchestrator.deployments[optimism.id] ??
          orchestrator.deployments[String(optimism.id)];
        const addr =
          dep?.address || dep?.smartAccountAddress || dep?.predictedAddress;
        if (addr) predicted = addr as `0x${string}`;
      }

      if (!predicted) {
        setDebugInfo({
          eoa: walletClient.account.address,
          chainId: optimism.id,
          meeVersion: 'V2_1_0',
          rpc: OPSP_RPC,
          orchestratorKeys: Object.keys(orchestrator ?? {}),
          tried,
          hasDeploymentsField: !!orchestrator?.deployments,
          hasAddressOn: typeof orchestrator.addressOn === 'function',
          hasDeploymentOn: typeof orchestrator.deploymentOn === 'function',
        });
        throw new Error(
          'Could not resolve Smart Account address with current Abstract.js build.'
        );
      }

      setSaAddress(predicted);
      setDebugInfo({
        eoa: walletClient.account.address,
        chainId: optimism.id,
        meeVersion: 'V2_1_0',
        rpc: OPSP_RPC,
        resolvedVia: tried,
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
              onClick={createBiconomySA}
              disabled={disabled}
              className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer'
            >
              {busy ? 'Working…' : 'Predict Smart Account Address'}
            </button>
          </section>
        )}

        <div className='mt-4 space-y-2 text-sm'>
          {error && (
            <p className='text-red-400'>
              <b>Error:</b> {error}
            </p>
          )}

          {saAddress && (
            <p>
              <b>Smart Account:</b>{' '}
              <a
                className='underline'
                href={`https://sepolia-optimism.etherscan.io/address/${saAddress}`}
                target='_blank'
                rel='noreferrer'
              >
                https://sepolia-optimism.etherscan.io/address/{saAddress}
              </a>
            </p>
          )}

          {debugInfo && (
            <details className='mt-2'>
              <summary className='cursor-pointer'>Debug info</summary>
              <pre className='mt-2 p-3 rounded bg-neutral-900 overflow-auto text-xs'>
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </section>
    </section>
  );
}

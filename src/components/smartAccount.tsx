'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { createPublicClient, http, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';

export default function SmartAccounts() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  const { data: walletClient } = useWalletClient({ account: address });

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle'
  );
  const [result, setResult] = useState<{
    accountAddress?: string;
    userOpHash?: string;
    bundlerTxHash?: string;
    error?: string;
  }>({});

  const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC;
  const entryPoint = useMemo(() => getEntryPoint('0.7'), []);
  const kernelVersion = KERNEL_V3_1;

  const publicClient = useMemo(() => {
    if (!ZERODEV_RPC) return null;
    return createPublicClient({
      chain: sepolia,
      transport: http(ZERODEV_RPC),
    });
  }, [ZERODEV_RPC]);

  async function sendUserOp() {
    try {
      if (!isConnected || !address) throw new Error('Connect a wallet first');
      if (!walletClient?.account)
        throw new Error('Wallet client has no account');
      if (chainId !== sepolia.id) throw new Error('Please switch to Sepolia');
      if (!publicClient) throw new Error('NEXT_PUBLIC_ZERODEV_RPC is not set');

      setStatus('running');
      setResult({});

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: walletClient,
        entryPoint,
        kernelVersion,
      });

      const account = await createKernelAccount(publicClient, {
        plugins: { sudo: ecdsaValidator },
        entryPoint,
        kernelVersion,
      });

      const paymasterClient = createZeroDevPaymasterClient({
        chain: sepolia,
        transport: http(ZERODEV_RPC),
      });

      const kernelClient = createKernelAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(ZERODEV_RPC),
        client: publicClient,
        paymaster: {
          getPaymasterData: (userOperation) =>
            paymasterClient.sponsorUserOperation({ userOperation }),
        },
      });

      const userOpHash = await kernelClient.sendUserOperation({
        callData: await account.encodeCalls([
          { to: zeroAddress, value: 0n, data: '0x' },
        ]),
      });

      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      setResult({
        accountAddress: account.address,
        userOpHash,
        bundlerTxHash: receipt.receipt.transactionHash,
      });
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setResult({ error: e?.message ?? String(e) });
    }
  }

  const disabled = !isConnected || !walletClient || status === 'running';

  return (
    <section className='w-full flex justify-center px-4'>
      <section className='w-1/2 flex flex-col justify-center items-center'>
        <ConnectButton showBalance={false} />
        {isConnected && (
          <section className='flex flex-col mt-4'>
            <p className='text-sm opacity-80'>Connected: {address}</p>
            <button
              onClick={sendUserOp}
              disabled={disabled}
              className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer'
            >
              {status === 'running'
                ? 'Sending…'
                : 'Create Smart Account & Send UserOp'}
            </button>
          </section>
        )}

        <section className='mt-4 space-y-1 text-sm'>
          {status === 'error' && (
            <p className='text-red-400'>
              <b>Error:</b> {result.error}
            </p>
          )}
          {result.accountAddress && (
            <>
              <p>
                <b>Account:</b>{' '}
                <a
                  href={`https://sepolia.etherscan.io/address/${result.accountAddress}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  {result.accountAddress}
                </a>
              </p>
              <p>
                <b>UserOp:</b> {result.userOpHash}
              </p>
              <p>
                <b>Bundler Tx:</b>{' '}
                <a
                  href={`https://sepolia.etherscan.io/tx/${result.bundlerTxHash}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  {result.bundlerTxHash}
                </a>
              </p>
            </>
          )}
        </section>
      </section>
    </section>
  );
}

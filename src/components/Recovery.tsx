'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import {
  createPublicClient,
  http,
  zeroAddress,
  encodeFunctionData,
  parseAbi,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  signerToEcdsaValidator,
  getValidatorAddress,
} from '@zerodev/ecdsa-validator';
import {
  createWeightedECDSAValidator,
  getRecoveryAction,
} from '@zerodev/weighted-ecdsa-validator';

export default function Recovery() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient({ account: address });

  const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC;
  const entryPoint = useMemo(() => getEntryPoint('0.7'), []);
  const kernelVersion = KERNEL_V3_1;

  const publicClient = useMemo(() => {
    if (!ZERODEV_RPC) return null;
    return createPublicClient({ chain: sepolia, transport: http(ZERODEV_RPC) });
  }, [ZERODEV_RPC]);

  const [demoCreated, setDemoCreated] = useState(false);
  const [accountAddress, setAccountAddress] = useState<`0x${string}` | null>(
    null
  );
  const [guardianPriv, setGuardianPriv] = useState<Hex | null>(null);

  const [kernelAccount, setKernelAccount] = useState<any>(null);
  const [kernelClient, setKernelClient] = useState<any>(null);

  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [beforeCanSend, setBeforeCanSend] = useState<boolean | null>(null);
  const [afterCanSend, setAfterCanSend] = useState<boolean | null>(null);

  const [recoveryUserOpHash, setRecoveryUserOpHash] = useState<
    `0x${string}` | null
  >(null);
  const [finalTxHash, setFinalTxHash] = useState<`0x${string}` | null>(null);

  const disabledGlobal =
    !isConnected || !walletClient || !publicClient || chainId !== sepolia.id;

  async function createDemoAccount() {
    try {
      setStatus('running');
      setError(null);
      if (disabledGlobal)
        throw new Error('Connect wallet, set RPC, and switch to Sepolia');

      const oldSigner = privateKeyToAccount(generatePrivateKey());
      const guardian = privateKeyToAccount(generatePrivateKey());
      setGuardianPriv(guardian.privateKey);

      const ecdsaValidator = await signerToEcdsaValidator(publicClient!, {
        signer: oldSigner,
        entryPoint,
        kernelVersion,
      });

      const guardianValidator = await createWeightedECDSAValidator(
        publicClient!,
        {
          entryPoint,
          config: {
            threshold: 100,
            signers: [{ address: guardian.address, weight: 100 }],
          },
          signers: [guardian],
          kernelVersion,
        }
      );

      const account = await createKernelAccount(publicClient!, {
        entryPoint,
        kernelVersion,
        plugins: {
          sudo: ecdsaValidator,
          regular: guardianValidator,
          action: getRecoveryAction(entryPoint.version),
        },
      });

      const paymasterClient = createZeroDevPaymasterClient({
        chain: sepolia,
        transport: http(ZERODEV_RPC!),
      });

      const kClient = createKernelAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(ZERODEV_RPC!),
        client: publicClient!,
        paymaster: {
          getPaymasterData: (userOperation) =>
            paymasterClient.sponsorUserOperation({ userOperation }),
        },
      });

      setKernelAccount(account);
      setKernelClient(kClient);
      setAccountAddress(account.address);
      setDemoCreated(true);
      setStatus('idle');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message ?? String(e));
    }
  }

  async function trySendWithConnectedWallet() {
    try {
      setStatus('running');
      setError(null);
      if (!accountAddress) throw new Error('Create the demo account first');
      if (!walletClient) throw new Error('Connect a wallet');

      const ecdsa = await signerToEcdsaValidator(publicClient!, {
        signer: walletClient,
        entryPoint,
        kernelVersion,
      });

      const account = await createKernelAccount(publicClient!, {
        address: accountAddress,
        entryPoint,
        kernelVersion,
        plugins: { sudo: ecdsa },
      });

      const paymaster = createZeroDevPaymasterClient({
        chain: sepolia,
        transport: http(ZERODEV_RPC!),
      });

      const client = createKernelAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(ZERODEV_RPC!),
        client: publicClient!,
        paymaster: {
          getPaymasterData: (uo) =>
            paymaster.sponsorUserOperation({ userOperation: uo }),
        },
      });

      try {
        const uoHash = await client.sendUserOperation({
          callData: await account.encodeCalls([
            { to: zeroAddress, value: 0n, data: '0x' },
          ]),
        });
        const receipt = await client.waitForUserOperationReceipt({
          hash: uoHash,
        });
        if (beforeCanSend === null) setBeforeCanSend(true);
        else setAfterCanSend(true);
        setFinalTxHash(receipt.receipt.transactionHash);
      } catch {
        // failure -> wallet is NOT sudo
        if (beforeCanSend === null) setBeforeCanSend(false);
        else setAfterCanSend(false);
      } finally {
        setStatus('idle');
      }
    } catch (e: any) {
      setStatus('error');
      setError(e?.message ?? String(e));
    }
  }

  async function runRecoveryOnSameAccount() {
    try {
      setStatus('running');
      setError(null);
      if (!kernelClient || !kernelAccount || !accountAddress) {
        throw new Error('Create the demo account first');
      }
      if (!walletClient?.account) throw new Error('Connect a wallet');

      const recoveryExecutorFunction =
        'function doRecovery(address _validator, bytes calldata _data)';
      const newOwnerAddress = walletClient.account.address as Hex;
      const validatorAddr = getValidatorAddress(entryPoint, kernelVersion);

      const rHash = await kernelClient.sendUserOperation({
        callData: encodeFunctionData({
          abi: parseAbi([recoveryExecutorFunction]),
          functionName: 'doRecovery',
          args: [validatorAddr, newOwnerAddress],
        }),
      });
      setRecoveryUserOpHash(rHash);

      await kernelClient.waitForUserOperationReceipt({ hash: rHash });
      setStatus('idle');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message ?? String(e));
    }
  }

  const globalGuard = !isConnected
    ? 'Connect a wallet'
    : chainId !== sepolia.id
    ? 'Switch to Sepolia'
    : !publicClient
    ? 'Set NEXT_PUBLIC_ZERODEV_RPC'
    : null;

  return (
    <section className='w-full flex justify-center px-4'>
      <section className='w-1/2 flex flex-col justify-center items-center'>
        <ConnectButton showBalance={false} />
        <h3 className='text-lg font-semibold mt-4 mb-2'>Recovery Demo</h3>

        {globalGuard && (
          <p className='text-sm text-yellow-600 mb-3'>⚠ {globalGuard}</p>
        )}

        <div className='w-full max-w-md space-y-2'>
          <button
            onClick={createDemoAccount}
            disabled={status === 'running' || disabledGlobal || demoCreated}
            className='px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer w-full'
          >
            {demoCreated ? 'Create Demo Account ✓' : 'Create Demo Account'}
          </button>

          <button
            onClick={trySendWithConnectedWallet}
            disabled={
              status === 'running' ||
              disabledGlobal ||
              !demoCreated ||
              beforeCanSend !== null
            }
            className='px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer w-full'
          >
            {beforeCanSend === null
              ? 'Try Send (Before Recovery)'
              : beforeCanSend
              ? 'Before: Succeeded'
              : 'Before: Failed ✓'}
          </button>

          <button
            onClick={runRecoveryOnSameAccount}
            disabled={
              status === 'running' ||
              disabledGlobal ||
              !demoCreated ||
              beforeCanSend === null ||
              !!recoveryUserOpHash
            }
            className='px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer w-full'
          >
            {recoveryUserOpHash
              ? 'Recovery Executed ✓'
              : 'Run Recovery (Guardian → Your Wallet)'}
          </button>

          <button
            onClick={trySendWithConnectedWallet}
            disabled={
              status === 'running' ||
              disabledGlobal ||
              !demoCreated ||
              !recoveryUserOpHash
            }
            className='px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer w-full'
          >
            {afterCanSend === null
              ? 'Try Send (After Recovery)'
              : afterCanSend
              ? 'After: Succeeded ✓'
              : 'After: Failed'}
          </button>

          <div className='mt-2 space-y-1 text-sm'>
            {error && (
              <p className='text-red-400'>
                <b>Error:</b> {error}
              </p>
            )}

            {accountAddress && (
              <p>
                <b>Account:</b>{' '}
                <a
                  href={`https://sepolia.etherscan.io/address/${accountAddress}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  {accountAddress}
                </a>
              </p>
            )}

            {recoveryUserOpHash && (
              <p>
                <b>Recovery UserOp:</b> {recoveryUserOpHash}
              </p>
            )}

            {finalTxHash && (
              <p>
                <b>Tx:</b>{' '}
                <a
                  href={`https://sepolia.etherscan.io/tx/${finalTxHash}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  {finalTxHash}
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

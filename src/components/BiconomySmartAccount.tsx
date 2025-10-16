'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { http } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import {
  createMeeClient,
  getDefaultMeeGasTank,
  getDefaultMEENetworkUrl,
  getMEEVersion,
  MEEVersion,
  toMultichainNexusAccount,
} from '@biconomy/abstractjs';

function safeStringify(value: unknown, space = 2) {
  return JSON.stringify(
    value,
    (_key, val) => (typeof val === 'bigint' ? val.toString() : val),
    space
  );
}

export default function BiconomySmartAccount() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ account: eoaAddress });

  const OPSP_RPC = process.env.NEXT_PUBLIC_OPSP_RPC;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // post-deploy SA address
  const [saAddress, setSaAddress] = useState<`0x${string}` | null>(null);

  // identifiers that might come back from execute()
  const [meeHash, setMeeHash] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<any[] | null>(null);
  const [checking, setChecking] = useState(false);

  const IS_STAGING = true;
  const STAGING_API_KEY =
    process.env.NEXT_PUBLIC_BICONOMY_API_KEY_STAGING ??
    'mee_3Zmc7H6Pbd5wUfUGu27aGzdf';

  const opSepoliaTransport = useMemo(() => http(OPSP_RPC), [OPSP_RPC]);

  function makeCompatSigner(client: typeof walletClient) {
    if (!client?.account) return null;
    const addr = client.account.address;
    return {
      ...client,
      getAddress: async () => addr,
      getAddresses: async () => [addr],
    } as any;
  }

  async function resolveSaAddress(account: any): Promise<`0x${string}` | null> {
    try {
      const addr =
        (await account.addressOn?.(optimismSepolia)) ??
        (await account.addressOn?.({ chain: optimismSepolia })) ??
        (await account.addressOn?.(optimismSepolia.id));
      return addr as `0x${string}` | null;
    } catch {
      return null;
    }
  }

  async function deployAndNoop() {
    try {
      setBusy(true);
      setError(null);

      // clear previous results
      setSaAddress(null);
      setMeeHash(null);
      setTaskId(null);
      setRequestId(null);
      setUserOpHash(null);
      setTxHash(null);
      setReceipts(null);

      if (!isConnected || !walletClient?.account) {
        throw new Error('Connect a wallet first.');
      }

      const signerCompat = makeCompatSigner(walletClient);
      if (!signerCompat) throw new Error('Could not prepare signer.');

      const account = await toMultichainNexusAccount({
        signer: signerCompat,
        chainConfigurations: [
          {
            chain: optimismSepolia,
            transport: opSepoliaTransport,
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        transports: {
          [optimismSepolia.id]: opSepoliaTransport,
        },
      });

      const meeClient = await createMeeClient({
        account,
        url: getDefaultMEENetworkUrl(IS_STAGING),
        apiKey: STAGING_API_KEY,
      });

      // Build a sponsored no-op to trigger deployment if needed
      const noopInstruction = await (account as any).build({
        type: 'default',
        data: {
          calls: [
            {
              to: '0x0000000000000000000000000000000000000000',
              value: 0n,
              data: '0x',
              gasLimit: 20000n,
            },
          ],
          chainId: optimismSepolia.id,
        },
      });

      const result = await meeClient.execute({
        instructions: [noopInstruction],
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(IS_STAGING),
          gasTank: getDefaultMeeGasTank(IS_STAGING),
        },
      });

      // Collect identifiers (SDK result shapes may vary)
      const maybeMeeHash =
        (result as any)?.meeHash ?? (result as any)?.hash ?? null;

      const maybeTaskId = (result as any)?.taskId ?? null;
      const maybeRequestId = (result as any)?.requestId ?? null;
      const maybeUserOpHash =
        (result as any)?.userOpHash ??
        (result as any)?.user_operation_hash ??
        null;

      const maybeReceipts =
        (result as any)?.receipts ??
        (Array.isArray(result as any) ? (result as any) : null);

      const maybeTxHash =
        (maybeReceipts && maybeReceipts[0]?.transactionHash) ||
        (result as any)?.transactionHash ||
        null;

      setMeeHash(maybeMeeHash);
      setTaskId(maybeTaskId);
      setRequestId(maybeRequestId);
      setUserOpHash(maybeUserOpHash);
      setReceipts(maybeReceipts ?? null);
      setTxHash(maybeTxHash);

      // After execute (deployment if needed), resolve & show the SA address
      const addr = await resolveSaAddress(account);
      if (addr) setSaAddress(addr);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (!meeHash) return;
    try {
      setChecking(true);
      setError(null);

      if (!isConnected || !walletClient?.account) {
        throw new Error('Connect a wallet first.');
      }
      const signerCompat = makeCompatSigner(walletClient);
      const account = await toMultichainNexusAccount({
        signer: signerCompat!,
        chainConfigurations: [
          {
            chain: optimismSepolia,
            transport: opSepoliaTransport,
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
        transports: { [optimismSepolia.id]: opSepoliaTransport },
      });
      const meeClient = await createMeeClient({
        account,
        url: getDefaultMEENetworkUrl(IS_STAGING),
        apiKey: STAGING_API_KEY,
      });

      // Preferred in newer SDKs
      let receipt: any = null;
      if (
        typeof (meeClient as any).waitForSupertransactionReceipt === 'function'
      ) {
        try {
          receipt = await (meeClient as any).waitForSupertransactionReceipt({
            hash: meeHash,
          });
        } catch {
          receipt = await (meeClient as any).waitForSupertransactionReceipt(
            meeHash
          );
        }
      }

      // Fallback to a direct request if helper isn’t present
      if (!receipt && typeof (meeClient as any).request === 'function') {
        receipt = await (meeClient as any).request({
          path: `/v2/supertransactions/${meeHash}`,
          method: 'GET',
        });
      }

      if (!receipt)
        throw new Error('Could not fetch supertransaction receipt.');

      const asArray = Array.isArray(receipt)
        ? receipt
        : receipt?.receipts
        ? receipt.receipts
        : [receipt];

      setReceipts(asArray);

      const first = asArray[0];
      const hashFromReceipt =
        first?.transactionHash ?? receipt?.transactionHash ?? null;

      if (hashFromReceipt) setTxHash(hashFromReceipt as string);

      if (!saAddress) {
        const addr = await resolveSaAddress(account);
        if (addr) setSaAddress(addr);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setChecking(false);
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
              onClick={deployAndNoop}
              disabled={disabled}
              className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer'
            >
              {busy ? 'Working…' : 'Deploy SA & Send No-Op (Sponsored)'}
            </button>
            {meeHash && (
              <button
                onClick={checkStatus}
                disabled={checking}
                className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer'
              >
                {checking
                  ? 'Checking…'
                  : 'Check Execution Status (via meeHash)'}
              </button>
            )}
          </section>
        )}

        <div className='mt-4 space-y-2 text-sm w-full max-w-xl'>
          {error && (
            <p className='text-red-400'>
              <b>Error:</b> {error}
            </p>
          )}

          {saAddress && (
            <p>
              <b>Smart Account:</b>{' '}
              <a
                href={`https://sepolia-optimism.etherscan.io/address/${saAddress}`}
                target='_blank'
                rel='noreferrer'
              >
                {saAddress}
              </a>
            </p>
          )}

          {meeHash && (
            <p>
              <b>MEE Hash:</b>{' '}
              <a
                href={`https://meescan.biconomy.io/details/${meeHash}`}
                target='_blank'
                rel='noreferrer'
              >
                {meeHash}
              </a>
            </p>
          )}

          {taskId && (
            <p>
              <b>Task ID:</b> {taskId}
            </p>
          )}

          {requestId && (
            <p>
              <b>Request ID:</b> {requestId}
            </p>
          )}

          {userOpHash && (
            <p>
              <b>UserOp Hash:</b> {userOpHash}
            </p>
          )}

          {txHash && (
            <p>
              <b>Tx Hash:</b>{' '}
              <a
                href={`https://sepolia-optimism.etherscan.io/tx/${txHash}`}
                target='_blank'
                rel='noreferrer'
              >
                {txHash}
              </a>
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

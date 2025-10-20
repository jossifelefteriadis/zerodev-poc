'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { http, createPublicClient, type Hex } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import {
  createMeeClient,
  getDefaultMeeGasTank,
  getDefaultMEENetworkUrl,
  getMEEVersion,
  MEEVersion,
  toMultichainNexusAccount,
  toNexusAccount,
} from '@biconomy/abstractjs';

const OP_SEPOLIA_ID = 11155420;
const SOPHON_ID = 531050204;

const SOPHON_CHAIN = {
  id: SOPHON_ID,
  name: 'Sophon Testnet',
  nativeCurrency: { name: 'SOPH', symbol: 'SOPH', decimals: 18 },
  rpcUrls: {
    default: { http: [''] },
  },
  blockExplorers: {
    default: {
      name: 'Sophon Explorer',
      url: 'https://block-explorer.zksync-os-testnet-sophon.zksync.dev',
    },
  },
} as any;

const SOPHON_ADDR = {
  NEXUS_FACTORY: '0x0000006648ED9B2B842552BE63Af870bC74af837',
};

export default function BiconomySmartAccount() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ account: eoaAddress });
  const chainId = useChainId();

  const OPSP_RPC = process.env.NEXT_PUBLIC_OPSP_RPC;
  const SOPHON_RPC = process.env.NEXT_PUBLIC_SOPHON_RPC;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saAddress, setSaAddress] = useState<`0x${string}` | null>(null);

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

  const opSepoliaTransport = useMemo(
    () => (OPSP_RPC ? http(OPSP_RPC) : undefined),
    [OPSP_RPC]
  );

  const sophonChain = useMemo(() => {
    if (SOPHON_RPC) {
      return {
        ...SOPHON_CHAIN,
        rpcUrls: {
          default: { http: [SOPHON_RPC] },
        },
      };
    }
    return null;
  }, [SOPHON_RPC]);

  const publicClient = useMemo(() => {
    if (!chainId) return null;
    if (chainId === OP_SEPOLIA_ID && OPSP_RPC) {
      return createPublicClient({
        chain: optimismSepolia,
        transport: http(OPSP_RPC),
      });
    }
    if (chainId === SOPHON_ID && SOPHON_RPC) {
      return createPublicClient({
        chain: sophonChain,
        transport: http(SOPHON_RPC),
      });
    }
    return null;
  }, [chainId, OPSP_RPC, SOPHON_RPC]);

  const explorerBase = useMemo(() => {
    if (chainId === OP_SEPOLIA_ID)
      return 'https://sepolia-optimism.etherscan.io';
    if (chainId === SOPHON_ID)
      return 'https://block-explorer.zksync-os-testnet-sophon.zksync.dev';
    return null;
  }, [chainId]);

  function makeCompatSigner(client: typeof walletClient) {
    if (!client?.account) return null;
    const addr = client.account.address;
    return {
      ...client,
      getAddress: async () => addr,
      getAddresses: async () => [addr],
    } as any;
  }

  async function resolveSaAddressOPSP(
    account: any
  ): Promise<`0x${string}` | null> {
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

  async function resolveSaAddressSophon(
    account: any
  ): Promise<`0x${string}` | null> {
    try {
      const addr =
        (await account.address) ??
        (await account.getAddress?.()) ??
        (account.address as string);
      return addr as `0x${string}` | null;
    } catch (e) {
      console.error('Error resolving Sophon address:', e);
      return null;
    }
  }

  async function deploySmartAccount() {
    try {
      setBusy(true);
      setError(null);
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
      if (!publicClient) {
        throw new Error('RPC not configured for the current chain.');
      }

      // ---------- OP Sepolia (MEE) ----------
      if (chainId === OP_SEPOLIA_ID) {
        if (!opSepoliaTransport) throw new Error('Set NEXT_PUBLIC_OPSP_RPC');

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
        });

        const meeClient = await createMeeClient({
          account,
          url: getDefaultMEENetworkUrl(IS_STAGING),
          apiKey: STAGING_API_KEY,
        });

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

        const addr = await resolveSaAddressOPSP(account);
        if (addr) setSaAddress(addr);

        return;
      }

      if (chainId === SOPHON_ID) {
        if (!SOPHON_RPC) throw new Error('Set NEXT_PUBLIC_SOPHON_RPC');

        const signerCompat = makeCompatSigner(walletClient);
        if (!signerCompat) throw new Error('Could not prepare signer.');

        const nexusAccount = await toNexusAccount({
          signer: signerCompat,
          chainConfiguration: {
            chain: sophonChain,
            transport: http(SOPHON_RPC),
            version: getMEEVersion(MEEVersion.V2_1_0),
            versionCheck: false,
          },
        });

        const accountAddress = await resolveSaAddressSophon(nexusAccount);
        if (!accountAddress)
          throw new Error('Could not resolve account address');

        setSaAddress(accountAddress);

        const code = await publicClient.getCode({ address: accountAddress });
        const isDeployed = code && code !== '0x';

        if (isDeployed) {
          return;
        }

        const accountData = nexusAccount as any;
        let factoryData: Hex | null = null;

        if (accountData.factoryData) {
          factoryData = accountData.factoryData;
        } else if (accountData.getFactoryData) {
          factoryData = await accountData.getFactoryData();
        } else if (accountData.getInitCode) {
          const fullInitCode = await accountData.getInitCode();
          if (fullInitCode.length > 42) {
            factoryData = ('0x' + fullInitCode.slice(42)) as Hex;
          }
        }

        if (!factoryData) {
          throw new Error('Could not get factory data for deployment');
        }

        const deployHash = await walletClient.sendTransaction({
          to: SOPHON_ADDR.NEXUS_FACTORY,
          data: factoryData,
          value: 0n,
        });

        setTxHash(deployHash);

        const deployReceipt = await publicClient.waitForTransactionReceipt({
          hash: deployHash,
          timeout: 60_000,
        });

        if (deployReceipt.status === 'success') {
          const newCode = await publicClient.getCode({
            address: accountAddress,
          });
          if (!newCode || newCode === '0x') {
            setError('Transaction succeeded but account has no code');
          }
        } else {
          setError('Deployment transaction failed');
        }

        setReceipts([deployReceipt]);

        return;
      }

      throw new Error(`Unsupported chain: ${chainId}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      console.error('Deployment error:', e);
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
      if (chainId !== OP_SEPOLIA_ID) return;

      const signerCompat = {
        ...walletClient,
        getAddress: async () => walletClient.account.address,
        getAddresses: async () => [walletClient.account.address],
      } as any;

      const account = await toMultichainNexusAccount({
        signer: signerCompat,
        chainConfigurations: [
          {
            chain: optimismSepolia,
            transport: opSepoliaTransport!,
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      const meeClient = await createMeeClient({
        account,
        url: getDefaultMEENetworkUrl(IS_STAGING),
        apiKey: STAGING_API_KEY,
      });

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
        const addr = await resolveSaAddressOPSP(account);
        if (addr) setSaAddress(addr);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setChecking(false);
    }
  }

  const disabled = !isConnected || !walletClient || !publicClient || busy;

  return (
    <section className='w-full flex justify-center px-4 py-8'>
      <section className='w-full max-w-2xl flex flex-col justify-center items-center'>
        <ConnectButton showBalance={false} />
        {isConnected && (
          <section className='flex flex-col mt-4 w-full'>
            <p className='text-sm opacity-80 mb-2'>Connected: {eoaAddress}</p>
            <button
              onClick={deploySmartAccount}
              disabled={disabled}
              className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition'
            >
              {busy ? 'Deploying...' : 'Deploy Smart Account'}
            </button>
            {meeHash && chainId === OP_SEPOLIA_ID && (
              <button
                onClick={checkStatus}
                disabled={checking}
                className='mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition'
              >
                {checking
                  ? 'Checking…'
                  : 'Check Execution Status (via meeHash)'}
              </button>
            )}
          </section>
        )}

        <section className='mt-4 space-y-2 text-sm w-full'>
          {error && (
            <section className='p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400'>
              <b>Error:</b> {error}
            </section>
          )}

          {saAddress && (
            <section>
              <b>Smart Account:</b>{' '}
              {explorerBase ? (
                <a
                  href={`${explorerBase}/address/${saAddress}`}
                  target='_blank'
                  rel='noreferrer'
                  className='text-blue-400 hover:underline break-all'
                >
                  {saAddress}
                </a>
              ) : (
                <span className='break-all'>{saAddress}</span>
              )}
            </section>
          )}

          {meeHash && chainId === OP_SEPOLIA_ID && (
            <p>
              <b>MEE Hash:</b>{' '}
              <a
                href={`https://meescan.biconomy.io/details/${meeHash}`}
                target='_blank'
                rel='noreferrer'
                className='text-blue-400 hover:underline break-all'
              >
                {meeHash}
              </a>
            </p>
          )}

          {taskId && (
            <p>
              <b>Task ID:</b> <span className='break-all'>{taskId}</span>
            </p>
          )}

          {requestId && (
            <p>
              <b>Request ID:</b> <span className='break-all'>{requestId}</span>
            </p>
          )}

          {userOpHash && (
            <p>
              <b>UserOp Hash:</b>{' '}
              <span className='break-all'>{userOpHash}</span>
            </p>
          )}

          {txHash && (
            <p>
              <b>Tx Hash:</b>{' '}
              {explorerBase ? (
                <a
                  href={`${explorerBase}/tx/${txHash}`}
                  target='_blank'
                  rel='noreferrer'
                  className='text-blue-400 hover:underline break-all'
                >
                  {txHash}
                </a>
              ) : (
                <span className='break-all'>{txHash}</span>
              )}
            </p>
          )}
        </section>
      </section>
    </section>
  );
}

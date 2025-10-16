'use client';

import { useState } from 'react';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import {
  PasskeyValidatorContractVersion,
  WebAuthnMode,
  toPasskeyValidator,
  toWebAuthnKey,
} from '@zerodev/passkey-validator';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { createPublicClient, http, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';

const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC || '';
const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_PASSKEY_SERVER_URL || '';

const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_1;

export default function PasskeyAccount() {
  const [username, setUsername] = useState('');
  const [accountAddress, setAccountAddress] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAccountReady, setIsAccountReady] = useState(false);
  const [isSendingTx, setIsSendingTx] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const [kernelAccount, setKernelAccount] = useState<any>(null);
  const [kernelClient, setKernelClient] = useState<any>(null);

  const publicClient = ZERODEV_RPC
    ? createPublicClient({ transport: http(ZERODEV_RPC), chain: sepolia })
    : null;

  const createAccountAndClient = async (passkeyValidator: any) => {
    if (!publicClient) throw new Error('NEXT_PUBLIC_ZERODEV_RPC is not set');

    const account = await createKernelAccount(publicClient, {
      entryPoint,
      plugins: { sudo: passkeyValidator },
      kernelVersion,
    });

    setAccountAddress(account.address);
    setKernelAccount(account);

    const paymasterClient = createZeroDevPaymasterClient({
      chain: sepolia,
      transport: http(ZERODEV_RPC),
    });

    const client = createKernelAccountClient({
      account,
      chain: sepolia,
      bundlerTransport: http(ZERODEV_RPC),
      client: publicClient,
      paymaster: {
        getPaymasterData: (userOperation) =>
          paymasterClient.sponsorUserOperation({ userOperation }),
      },
    });

    setKernelClient(client);
    setIsAccountReady(true);
  };

  const handleRegister = async () => {
    if (!username) return setError('Please enter a username');
    try {
      setIsRegistering(true);
      setError('');

      const rpId =
        typeof window !== 'undefined' ? window.location.hostname : 'localhost';

      const webAuthnKey = await toWebAuthnKey({
        passkeyName: username,
        passkeyServerUrl: PASSKEY_SERVER_URL,
        mode: WebAuthnMode.Register,
        passkeyServerHeaders: {},
        rpID: rpId,
      });

      const passkeyValidator = await toPasskeyValidator(publicClient!, {
        webAuthnKey,
        entryPoint,
        kernelVersion,
        validatorContractVersion:
          PasskeyValidatorContractVersion.V0_0_3_PATCHED,
      });

      await createAccountAndClient(passkeyValidator);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'Failed to register passkey'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogin = async () => {
    if (!username) return setError('Please enter a username');
    try {
      setIsLoggingIn(true);
      setError('');

      const rpId =
        typeof window !== 'undefined' ? window.location.hostname : 'localhost';

      const webAuthnKey = await toWebAuthnKey({
        passkeyName: username,
        passkeyServerUrl: PASSKEY_SERVER_URL,
        mode: WebAuthnMode.Login,
        passkeyServerHeaders: {},
        rpID: rpId,
      });

      const passkeyValidator = await toPasskeyValidator(publicClient!, {
        webAuthnKey,
        entryPoint,
        kernelVersion,
        validatorContractVersion:
          PasskeyValidatorContractVersion.V0_0_3_PATCHED,
      });

      await createAccountAndClient(passkeyValidator);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSendTransaction = async () => {
    if (!kernelClient || !kernelAccount) {
      return setError('Account not ready. Please register or login first.');
    }
    try {
      setIsSendingTx(true);
      setError('');

      const userOpHash = await kernelClient.sendUserOperation({
        callData: await kernelAccount.encodeCalls([
          { to: zeroAddress, value: 0n, data: '0x' },
        ]),
      });

      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      setTxHash(receipt.receipt.transactionHash);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'Failed to send transaction'
      );
    } finally {
      setIsSendingTx(false);
    }
  };

  const btnBase =
    'px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer';
  const inputBase =
    'w-full px-3 py-2 rounded-lg border border-neutral-600 bg-transparent outline-none';

  return (
    <section className='w-full flex justify-center px-4'>
      <section className='w-1/2 flex flex-col justify-center items-center'>
        <h3 className='text-lg font-semibold mb-3'>Passkey Account</h3>

        {!ZERODEV_RPC && (
          <p className='text-sm text-yellow-600 mb-3'>
            ⚠ Set <code>NEXT_PUBLIC_ZERODEV_RPC</code> in{' '}
            <code>.env.local</code>
          </p>
        )}

        <div className='w-full max-w-md space-y-3'>
          <div>
            <label className='block text-sm mb-1'>Username</label>
            <input
              className={inputBase}
              placeholder='Enter a username'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isAccountReady}
            />
          </div>

          {error && (
            <p className='text-sm text-red-400'>
              <b>Error:</b> {error}
            </p>
          )}

          {!isAccountReady && ZERODEV_RPC && (
            <div className='flex gap-2'>
              <button
                onClick={handleRegister}
                disabled={isRegistering || isLoggingIn || !username}
                className={btnBase}
              >
                {isRegistering ? 'Registering…' : 'Register Passkey'}
              </button>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn || isRegistering || !username}
                className={btnBase}
              >
                {isLoggingIn ? 'Logging in…' : 'Login with Passkey'}
              </button>
            </div>
          )}

          {isAccountReady && (
            <>
              <p className='text-sm opacity-80'>
                <b>Account:</b>{' '}
                <a
                  href={`https://sepolia.etherscan.io/address/${accountAddress}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  {accountAddress}
                </a>
              </p>

              <button
                onClick={handleSendTransaction}
                disabled={isSendingTx}
                className={btnBase}
              >
                {isSendingTx ? 'Sending…' : 'Send Test Transaction'}
              </button>
            </>
          )}

          {txHash && (
            <p className='text-sm'>
              <b>Bundler Tx:</b>{' '}
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
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

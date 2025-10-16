'use client';
import { useState } from 'react';
import SmartAccounts from '@/components/smartAccount';
import PasskeyAccount from '@/components/PasskeyAccount';
import Recovery from '@/components/Recovery';
import SophonSmartAccount from '@/components/SophonSmartAccount';
import ManualUserOpSender from '@/components/ManualUserOpSender';

import BiconomyPredictSA from '@/components/BiconomyPredictSA';
import BiconomySmartAccount from '@/components/BiconomySmartAccount';

export default function Home() {
  const [zdActiveTab, setZdActiveTab] = useState<
    'smartaccount' | 'passkey' | 'recovery' | 'ssa'
  >('smartaccount');
  const [bActiveTab, setBActiveTab] = useState<'psa' | 'smartaccount'>('psa');
  const [demo, setDemo] = useState<'zerodev' | 'biconomy'>('zerodev');

  return (
    <section className='font-sans items-center justify-items-center min-h-screen'>
      <main className='w-full h-screen flex flex-col items-center'>
        <header className='bg-[url(../assets/header-bg.png)] w-full h-30 flex justify-center items-center'>
          <h1 className='text-2xl'>FRAMEWORK POC</h1>
        </header>
        <section className='flex items-center gap-3 mt-4'>
          <span className={demo === 'zerodev' ? 'font-medium' : 'opacity-60'}>
            zerodev
          </span>
          <button
            type='button'
            role='switch'
            aria-checked={demo === 'biconomy'}
            onClick={() =>
              setDemo((d) => (d === 'zerodev' ? 'biconomy' : 'zerodev'))
            }
            className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border border-neutral-600 transition-colors
      ${demo === 'biconomy' ? 'bg-neutral-200/20' : 'bg-transparent'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
        ${demo === 'biconomy' ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>

          <span className={demo === 'biconomy' ? 'font-medium' : 'opacity-60'}>
            biconomy
          </span>
        </section>
        {demo === 'zerodev' && (
          <section className='w-full flex flex-col items-center'>
            <section className='w-1/3 flex justify-evenly mt-4'>
              <button
                onClick={() => setZdActiveTab('smartaccount')}
                className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'
              >
                Smart Account
              </button>
              <button
                onClick={() => setZdActiveTab('passkey')}
                className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'
              >
                Passkey
              </button>
              <button
                onClick={() => setZdActiveTab('recovery')}
                className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'
              >
                Recovery
              </button>
              <button
                onClick={() => setZdActiveTab('ssa')}
                className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'
              >
                SSA
              </button>
            </section>
            <section className='w-full h-full flex flex-col items-center mt-10'>
              {zdActiveTab === 'smartaccount' && <SmartAccounts />}
              {zdActiveTab === 'passkey' && <PasskeyAccount />}
              {zdActiveTab === 'recovery' && <Recovery />}
              {/* {zdActiveTab === 'ssa' && <SophonSmartAccount />} */}
              {zdActiveTab === 'ssa' && <ManualUserOpSender />}
            </section>
          </section>
        )}
        {demo === 'biconomy' && (
          <section className='w-full flex flex-col items-center'>
            <section className='w-1/3 flex justify-evenly mt-4'>
              <button
                onClick={() => setBActiveTab('psa')}
                className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'
              >
                Predict SA
              </button>
              <button
                onClick={() => setBActiveTab('smartaccount')}
                className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'
              >
                Smart Account
              </button>
            </section>
            <section className='w-full h-full flex flex-col items-center mt-10'>
              {bActiveTab === 'psa' && <BiconomyPredictSA />}
              {bActiveTab === 'smartaccount' && <BiconomySmartAccount />}
            </section>
          </section>
        )}
      </main>
    </section>
  );
}

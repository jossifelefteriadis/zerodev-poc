"use client"
import { useState } from 'react';
import SmartAccounts from "@/components/smartAccount";
import PasskeyAccount from '@/components/PasskeyAccount';
import Recovery from '@/components/Recovery';

export default function Home() {
  const [activeTab, setActiveTab] = useState<"smartaccount" | "passkey" | "recovery">(
    "smartaccount"
  );
  return (
    <section className="font-sans items-center justify-items-center min-h-screen">
      <main className="w-full h-screen flex flex-col items-center">
        <header className='bg-[url(../assets/header-bg.png)] w-full h-30 flex justify-center items-center'>
        <h1 className='text-2xl'>
          ZERODEV POC
        </h1>
        </header>
        <section className='w-1/3 flex justify-evenly mt-4'>
          <button onClick={() => setActiveTab("smartaccount")} className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'>Smart Account</button>
          <button onClick={() => setActiveTab("passkey")} className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'>Passkey</button>
          <button onClick={() => setActiveTab("recovery")} className='bg-[#0096f7] w-34 h-8 cursor-pointer rounded'>Recovery</button>
        </section>
        <section className="w-full h-full flex flex-col items-center mt-10">
          {
            activeTab === 'smartaccount' && (
              <SmartAccounts />
            )
          }
          {
            activeTab === 'passkey' && (
              <PasskeyAccount />
            )
          }
          {
            activeTab === 'recovery' && (
              <Recovery />
            )
          }
        </section>
      </main>
    </section>
  );
}

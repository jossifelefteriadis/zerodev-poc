// 'use client';

// import React, { useState, useEffect } from 'react';
// import { http, createPublicClient } from 'viem';
// import { optimismSepolia } from 'viem/chains';
// import { privateKeyToAccount } from 'viem/accounts';

// import {
//   createMeeClient,
//   getDefaultMeeGasTank,
//   getDefaultMEENetworkUrl,
//   getMEEVersion,
//   MEEVersion,
//   toMultichainNexusAccount,
//   toNexusAccount,
// } from '@biconomy/abstractjs';
// import {
//   createBundlerClient,
//   sendUserOperation,
// } from 'viem/account-abstraction';

// const IS_STAGING = true;
// const STAGING_API_KEY = 'mee_3Zmc7H6Pbd5wUfUGu27aGzdf';
// const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// const SOPHON_ID = 531050204;

// const SOPHON_CHAIN = {
//   id: SOPHON_ID,
//   name: 'Sophon Testnet',
//   nativeCurrency: { name: 'SOPH', symbol: 'SOPH', decimals: 18 },
//   rpcUrls: {
//     default: { http: [''] },
//   },
//   blockExplorers: {
//     default: {
//       name: 'Sophon Explorer',
//       url: 'https://block-explorer.zksync-os-testnet-sophon.zksync.dev',
//     },
//   },
// } as any;

// const SOPHON_ADDR = {
//   NEXUS_FACTORY: '0x0000006648ED9B2B842552BE63Af870bC74af837',
// };

// interface UserAccount {
//   email: string;
//   name: string;
//   picture: string;
//   privateKey: string;
// }

// export default function GoogleSmartAccount() {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [status, setStatus] = useState<string>('');
//   const [googleUser, setGoogleUser] = useState<UserAccount | null>(null);
//   const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
//     null
//   );
//   const [sophonAccountAddress, setSophonAccountAddress] = useState<
//     string | null
//   >(null);
//   const [balance, setBalance] = useState<string | null>(null);
//   const [sophonBalance, setSophonBalance] = useState<string | null>(null);
//   const [eoaAddress, setEoaAddress] = useState<string | null>(null);
//   const [eoaSophonBalance, setEoaSophonBalance] = useState<string | null>(null);
//   const [meeHash, setMeeHash] = useState<string | null>(null);
//   const [sophonTxHash, setSophonTxHash] = useState<string | null>(null);

//   const OPSP_RPC =
//     process.env.NEXT_PUBLIC_OPSP_RPC || 'https://sepolia.optimism.io';
//   const SOPHON_RPC = process.env.NEXT_PUBLIC_SOPHON_RPC;
//   const SOPHON_BUNDLER = process.env.NEXT_PUBLIC_SOPHON_BUNDLER;

//   useEffect(() => {
//     if (!GOOGLE_CLIENT_ID) return;

//     const script = document.createElement('script');
//     script.src = 'https://accounts.google.com/gsi/client';
//     script.async = true;
//     script.defer = true;
//     document.body.appendChild(script);

//     script.onload = () => {
//       if (window.google) {
//         window.google.accounts.id.initialize({
//           client_id: GOOGLE_CLIENT_ID,
//           callback: handleGoogleSignIn,
//           ux_mode: 'popup',
//         });

//         const buttonDiv = document.getElementById('google-signin-button');
//         if (buttonDiv && !googleUser) {
//           window.google.accounts.id.renderButton(buttonDiv, {
//             theme: 'filled_black',
//             size: 'large',
//             width: 350,
//             text: 'signin_with',
//           });
//         }
//       }
//     };

//     return () => {
//       if (document.body.contains(script)) {
//         document.body.removeChild(script);
//       }
//     };
//   }, [googleUser]);

//   useEffect(() => {
//     const saved = localStorage.getItem('biconomy_google_account');
//     if (saved) {
//       try {
//         const parsed = JSON.parse(saved);
//         setGoogleUser(parsed);
//         restoreSmartAccount(parsed);
//       } catch (e) {
//         console.error('Failed to parse saved account:', e);
//       }
//     }
//   }, []);

//   const handleGoogleSignIn = async (response: any) => {
//     try {
//       setLoading(true);
//       setError(null);
//       setStatus('Processing Google sign-in...');

//       const credential = response.credential;
//       const payload = JSON.parse(atob(credential.split('.')[1]));

//       setStatus('Creating deterministic key from Google ID...');

//       const deterministicSeed = await deriveKeyFromGoogleId(payload.sub);

//       const userAccount: UserAccount = {
//         email: payload.email,
//         name: payload.name,
//         picture: payload.picture,
//         privateKey: deterministicSeed,
//       };

//       setGoogleUser(userAccount);
//       localStorage.setItem(
//         'biconomy_google_account',
//         JSON.stringify(userAccount)
//       );

//       setStatus('Creating smart account...');
//       await createSmartAccount(userAccount);
//     } catch (e: any) {
//       setError(e?.message ?? String(e));
//       console.error('Google sign-in error:', e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deriveKeyFromGoogleId = async (googleSub: string): Promise<string> => {
//     const encoder = new TextEncoder();
//     const data = encoder.encode(googleSub);
//     const hashBuffer = await crypto.subtle.digest('SHA-256', data);
//     const hashArray = Array.from(new Uint8Array(hashBuffer));
//     const hashHex = hashArray
//       .map((b) => b.toString(16).padStart(2, '0'))
//       .join('');
//     return `0x${hashHex}`;
//   };

//   const restoreSmartAccount = async (userAccount: UserAccount) => {
//     try {
//       setLoading(true);
//       setStatus('Restoring smart account...');
//       await createSmartAccount(userAccount);
//     } catch (e: any) {
//       console.error('Failed to restore account:', e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const createSmartAccount = async (userAccount: UserAccount) => {
//     try {
//       setStatus('Initializing smart account...');

//       const ownerAccount = privateKeyToAccount(
//         userAccount.privateKey as `0x${string}`
//       );
//       setEoaAddress(ownerAccount.address);

//       const smartAccount = await toMultichainNexusAccount({
//         signer: ownerAccount,
//         chainConfigurations: [
//           {
//             chain: optimismSepolia,
//             transport: http(OPSP_RPC),
//             version: getMEEVersion(MEEVersion.V2_1_0),
//           },
//         ],
//       });

//       const address = await smartAccount.addressOn(optimismSepolia.id);
//       if (!address) {
//         throw new Error('Failed to get smart account address');
//       }

//       setSmartAccountAddress(address as string);
//       setStatus('Smart account ready!');

//       await checkBalance(address as string);
//       await checkDeployment(address as string);

//       if (SOPHON_RPC) {
//         await createSophonAccount(userAccount);
//         await checkEoaSophonBalance(ownerAccount.address);
//       }
//     } catch (e: any) {
//       throw new Error(`Smart account creation failed: ${e.message}`);
//     }
//   };

//   const checkBalance = async (address: string) => {
//     try {
//       const publicClient = createPublicClient({
//         chain: optimismSepolia,
//         transport: http(OPSP_RPC),
//       });

//       const bal = await publicClient.getBalance({
//         address: address as `0x${string}`,
//       });

//       setBalance((Number(bal) / 1e18).toFixed(6));
//     } catch (e) {
//       console.error('Failed to check balance:', e);
//     }
//   };

//   const checkDeployment = async (address: string) => {
//     try {
//       const publicClient = createPublicClient({
//         chain: optimismSepolia,
//         transport: http(OPSP_RPC),
//       });

//       const code = await publicClient.getCode({
//         address: address as `0x${string}`,
//       });

//       const isDeployed = code && code !== '0x';
//       if (!isDeployed) {
//         setStatus('Smart account ready (not yet deployed on-chain)');
//       } else {
//         setStatus('✅ Smart account deployed and ready!');
//       }
//     } catch (e) {
//       console.error('Failed to check deployment:', e);
//     }
//   };

//   const createSophonAccount = async (userAccount: UserAccount) => {
//     try {
//       if (!SOPHON_RPC) return;

//       const ownerAccount = privateKeyToAccount(
//         userAccount.privateKey as `0x${string}`
//       );

//       const sophonChain = {
//         ...SOPHON_CHAIN,
//         rpcUrls: {
//           default: { http: [SOPHON_RPC] },
//         },
//       };

//       const nexusAccount = await toNexusAccount({
//         signer: ownerAccount,
//         chainConfiguration: {
//           chain: sophonChain,
//           transport: http(SOPHON_RPC),
//           version: getMEEVersion(MEEVersion.V2_1_0),
//           versionCheck: false,
//         },
//       });

//       const accountAddress = await resolveSophonAddress(nexusAccount);
//       if (accountAddress) {
//         setSophonAccountAddress(accountAddress);
//         await checkSophonBalance(accountAddress);
//         await checkSophonDeployment(accountAddress);
//       }
//     } catch (e) {
//       console.error('Failed to create Sophon account:', e);
//     }
//   };

//   const resolveSophonAddress = async (account: any): Promise<string | null> => {
//     try {
//       const addr =
//         (await account.address) ??
//         (await account.getAddress?.()) ??
//         (account.address as string);
//       return addr as string | null;
//     } catch (e) {
//       console.error('Error resolving Sophon address:', e);
//       return null;
//     }
//   };

//   const checkSophonBalance = async (address: string) => {
//     try {
//       if (!SOPHON_RPC) return;

//       const sophonChain = {
//         ...SOPHON_CHAIN,
//         rpcUrls: {
//           default: { http: [SOPHON_RPC] },
//         },
//       };

//       const publicClient = createPublicClient({
//         chain: sophonChain,
//         transport: http(SOPHON_RPC),
//       });

//       const bal = await publicClient.getBalance({
//         address: address as `0x${string}`,
//       });

//       setSophonBalance((Number(bal) / 1e18).toFixed(6));
//     } catch (e) {
//       console.error('Failed to check Sophon balance:', e);
//     }
//   };

//   const checkSophonDeployment = async (address: string) => {
//     try {
//       if (!SOPHON_RPC) return;

//       const sophonChain = {
//         ...SOPHON_CHAIN,
//         rpcUrls: {
//           default: { http: [SOPHON_RPC] },
//         },
//       };

//       const publicClient = createPublicClient({
//         chain: sophonChain,
//         transport: http(SOPHON_RPC),
//       });

//       const code = await publicClient.getCode({
//         address: address as `0x${string}`,
//       });

//       const isDeployed = code && code !== '0x';
//       if (!isDeployed) {
//         console.log('Sophon account not deployed yet');
//       } else {
//         console.log('Sophon account deployed');
//       }
//     } catch (e) {
//       console.error('Failed to check Sophon deployment:', e);
//     }
//   };

//   const checkEoaSophonBalance = async (address: string) => {
//     try {
//       if (!SOPHON_RPC) return;

//       const sophonChain = {
//         ...SOPHON_CHAIN,
//         rpcUrls: {
//           default: { http: [SOPHON_RPC] },
//         },
//       };

//       const publicClient = createPublicClient({
//         chain: sophonChain,
//         transport: http(SOPHON_RPC),
//       });

//       const bal = await publicClient.getBalance({
//         address: address as `0x${string}`,
//       });

//       setEoaSophonBalance((Number(bal) / 1e18).toFixed(6));
//     } catch (e) {
//       console.error('Failed to check EOA Sophon balance:', e);
//     }
//   };

//   const deployAccount = async () => {
//     if (!googleUser || loading) return;

//     try {
//       setLoading(true);
//       setError(null);
//       setStatus('Deploying smart account on-chain...');

//       const ownerAccount = privateKeyToAccount(
//         googleUser.privateKey as `0x${string}`
//       );

//       const smartAccount = await toMultichainNexusAccount({
//         signer: ownerAccount,
//         chainConfigurations: [
//           {
//             chain: optimismSepolia,
//             transport: http(OPSP_RPC),
//             version: getMEEVersion(MEEVersion.V2_1_0),
//           },
//         ],
//       });

//       const meeClient = await createMeeClient({
//         account: smartAccount,
//         url: getDefaultMEENetworkUrl(IS_STAGING),
//         apiKey: STAGING_API_KEY,
//       });

//       const deployInstruction = await smartAccount.build({
//         type: 'default',
//         data: {
//           calls: [
//             {
//               to: '0x0000000000000000000000000000000000000000',
//               value: 0n,
//               data: '0x',
//               gasLimit: 21000n,
//             },
//           ],
//           chainId: optimismSepolia.id,
//         },
//       });

//       const result = await meeClient.execute({
//         instructions: [deployInstruction],
//         sponsorship: true,
//         sponsorshipOptions: {
//           url: getDefaultMEENetworkUrl(IS_STAGING),
//           gasTank: getDefaultMeeGasTank(IS_STAGING),
//         },
//       });

//       const hash = (result as any)?.meeHash ?? (result as any)?.hash ?? null;
//       if (hash) {
//         setMeeHash(hash);
//         setStatus('✅ Smart account deployed successfully!');
//       }
//     } catch (e: any) {
//       setError(e?.message ?? String(e));
//       console.error('Deployment error:', e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deploySophonAccount = async () => {
//     if (!googleUser || !SOPHON_RPC || !sophonAccountAddress || loading) return;

//     try {
//       setLoading(true);
//       setError(null);
//       setStatus('Deploying Sophon account...');

//       const ownerAccount = privateKeyToAccount(
//         googleUser.privateKey as `0x${string}`
//       );

//       const sophonChain = {
//         ...SOPHON_CHAIN,
//         rpcUrls: {
//           default: { http: [SOPHON_RPC] },
//         },
//       };

//       const publicClient = createPublicClient({
//         chain: sophonChain,
//         transport: http(SOPHON_RPC),
//       });

//       const code = await publicClient.getCode({
//         address: sophonAccountAddress as `0x${string}`,
//       });
//       const isDeployed = code && code !== '0x';

//       if (isDeployed) {
//         setStatus('✅ Sophon account already deployed!');
//         setLoading(false);
//         return;
//       }

//       const nexusAccount = await toNexusAccount({
//         signer: ownerAccount,
//         chainConfiguration: {
//           chain: sophonChain,
//           transport: http(SOPHON_RPC),
//           version: getMEEVersion(MEEVersion.V2_1_0),
//           versionCheck: false,
//         },
//       });

//       if (SOPHON_BUNDLER) {
//         try {
//           setStatus('Trying bundler deployment...');

//           const bundlerClient = createBundlerClient({
//             client: publicClient,
//             transport: http(SOPHON_BUNDLER),
//           });

//           const userOpHash = await bundlerClient.sendUserOperation({
//             account: nexusAccount as any,
//             calls: [
//               {
//                 to: sophonAccountAddress as `0x${string}`,
//                 value: 0n,
//                 data: '0x',
//               },
//             ],
//             callGasLimit: 100000n,
//             verificationGasLimit: 500000n,
//             preVerificationGas: 50000n,
//           });

//           setSophonTxHash(userOpHash);
//           setStatus('Waiting for Sophon deployment...');

//           let receipt = null;
//           for (let i = 0; i < 30; i++) {
//             await new Promise((resolve) => setTimeout(resolve, 2000));

//             const newCode = await publicClient.getCode({
//               address: sophonAccountAddress as `0x${string}`,
//             });

//             if (newCode && newCode !== '0x') {
//               receipt = { success: true };
//               break;
//             }
//           }

//           if (receipt?.success) {
//             setStatus('✅ Sophon account deployed successfully!');
//             return;
//           } else {
//             throw new Error('Bundler timeout');
//           }
//         } catch (bundlerError) {
//           console.log(
//             'Bundler failed, trying direct deployment:',
//             bundlerError
//           );
//           setStatus('Bundler failed, trying direct deployment...');
//         }
//       }

//       const eoaBalance = await publicClient.getBalance({
//         address: ownerAccount.address,
//       });

//       if (eoaBalance < 100000000000000n) {
//         throw new Error(
//           'EOA needs at least 0.0001 SOPH for gas. Please fund: ' +
//             ownerAccount.address
//         );
//       }

//       const accountData = nexusAccount as any;
//       let factoryData: `0x${string}` | null = null;

//       if (accountData.factoryData) {
//         factoryData = accountData.factoryData;
//       } else if (accountData.getFactoryData) {
//         factoryData = await accountData.getFactoryData();
//       } else if (accountData.getInitCode) {
//         const fullInitCode = await accountData.getInitCode();
//         if (fullInitCode.length > 42) {
//           factoryData = ('0x' + fullInitCode.slice(42)) as `0x${string}`;
//         }
//       }

//       if (!factoryData) {
//         throw new Error('Could not get factory data for deployment');
//       }

//       const gasPrice = await publicClient.getGasPrice();

//       const tx = {
//         to: SOPHON_ADDR.NEXUS_FACTORY,
//         data: factoryData,
//         value: 0n,
//         gas: 3000000n,
//         gasPrice: gasPrice,
//         chainId: SOPHON_ID,
//         nonce: await publicClient.getTransactionCount({
//           address: ownerAccount.address,
//         }),
//       };

//       const signedTx = await ownerAccount.signTransaction(tx as any);
//       const deployHash = await publicClient.sendRawTransaction({
//         serializedTransaction: signedTx,
//       });

//       setSophonTxHash(deployHash);
//       setStatus('Waiting for Sophon deployment...');

//       const deployReceipt = await publicClient.waitForTransactionReceipt({
//         hash: deployHash,
//         timeout: 60_000,
//       });

//       if (deployReceipt.status === 'success') {
//         const newCode = await publicClient.getCode({
//           address: sophonAccountAddress as `0x${string}`,
//         });
//         if (!newCode || newCode === '0x') {
//           setError('Transaction succeeded but account has no code');
//         } else {
//           setStatus('✅ Sophon account deployed successfully!');
//         }
//       } else {
//         setError('Sophon deployment transaction failed');
//       }
//     } catch (e: any) {
//       setError(e?.message ?? String(e));
//       console.error('Sophon deployment error:', e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const signOut = () => {
//     setGoogleUser(null);
//     setSmartAccountAddress(null);
//     setSophonAccountAddress(null);
//     setBalance(null);
//     setSophonBalance(null);
//     setEoaAddress(null);
//     setEoaSophonBalance(null);
//     setMeeHash(null);
//     setSophonTxHash(null);
//     setStatus('');
//     setError(null);
//     localStorage.removeItem('biconomy_google_account');

//     if (window.google) {
//       window.google.accounts.id.disableAutoSelect();
//     }
//   };

//   return (
//     <div className='w-full flex justify-center px-4 py-8'>
//       <div className='w-full max-w-2xl flex flex-col items-center gap-6'>
//         <div className='text-center'>
//           <h1 className='text-3xl font-bold mb-2'>Google Smart Account</h1>
//         </div>

//         {!googleUser && (
//           <div className='w-full max-w-md p-8 bg-neutral-900/50 border border-neutral-700 rounded-2xl'>
//             <div className='flex flex-col items-center gap-4'>
//               <div className='text-6xl'>🔐</div>
//               <h2 className='text-xl font-semibold'>Get Started</h2>
//               <p className='text-sm text-center opacity-70'>
//                 Sign in with your Google account to automatically create a smart
//                 wallet
//               </p>

//               {GOOGLE_CLIENT_ID ? (
//                 <div id='google-signin-button' className='mt-4'></div>
//               ) : (
//                 <div className='mt-4 p-4 bg-orange-900/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm'>
//                   <b>⚠️ Configuration Required</b>
//                   <p className='mt-2 text-xs'>
//                     Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your .env
//                     file
//                   </p>
//                 </div>
//               )}

//               {loading && (
//                 <div className='text-sm opacity-70'>Processing...</div>
//               )}
//             </div>
//           </div>
//         )}

//         {googleUser && (
//           <div className='w-full max-w-md p-8 bg-neutral-900/50 border border-neutral-700 rounded-2xl'>
//             <div className='flex flex-col gap-4'>
//               <div className='flex items-center gap-3 pb-4 border-b border-neutral-700'>
//                 {googleUser.picture && (
//                   <img
//                     src={googleUser.picture}
//                     alt={googleUser.name}
//                     className='w-12 h-12 rounded-full'
//                   />
//                 )}
//                 <div className='flex-1'>
//                   <p className='font-semibold'>{googleUser.name}</p>
//                   <p className='text-sm opacity-70'>{googleUser.email}</p>
//                 </div>
//                 <button
//                   onClick={signOut}
//                   className='text-sm px-3 py-1 rounded-lg border border-neutral-600 hover:bg-neutral-800 transition'
//                 >
//                   Sign Out
//                 </button>
//               </div>

//               {smartAccountAddress && (
//                 <div className='space-y-3'>
//                   <div>
//                     <p className='text-xs opacity-70 mb-1'>
//                       Optimism Sepolia Smart Account
//                     </p>
//                     <a
//                       href={`https://sepolia-optimism.etherscan.io/address/${smartAccountAddress}`}
//                       target='_blank'
//                       rel='noreferrer'
//                       className='text-blue-400 hover:underline text-sm break-all'
//                     >
//                       {smartAccountAddress}
//                     </a>
//                     <p className='text-xs opacity-50 mt-1'>
//                       Also on{' '}
//                       <a
//                         href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/address/${smartAccountAddress}`}
//                         target='_blank'
//                         rel='noreferrer'
//                         className='text-blue-400 hover:underline'
//                       >
//                         Sophon Explorer
//                       </a>
//                     </p>
//                   </div>

//                   {balance !== null && (
//                     <div>
//                       <p className='text-xs opacity-70 mb-1'>
//                         OP Sepolia Balance
//                       </p>
//                       <p className='text-sm'>{balance} ETH</p>
//                     </div>
//                   )}

//                   <button
//                     onClick={deployAccount}
//                     disabled={loading}
//                     className='w-full mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition'
//                   >
//                     {loading
//                       ? 'Deploying...'
//                       : 'Deploy OP Sepolia Account (Gasless)'}
//                   </button>

//                   {meeHash && (
//                     <div>
//                       <p className='text-xs opacity-70 mb-1'>
//                         OP Sepolia Deployment
//                       </p>
//                       <a
//                         href={`https://meescan.biconomy.io/details/${meeHash}`}
//                         target='_blank'
//                         rel='noreferrer'
//                         className='text-blue-400 hover:underline text-sm break-all'
//                       >
//                         {meeHash}
//                       </a>
//                     </div>
//                   )}

//                   {sophonAccountAddress && (
//                     <>
//                       <div className='pt-4 border-t border-neutral-700'>
//                         <p className='text-xs opacity-70 mb-1'>
//                           Sophon Testnet Smart Account
//                         </p>
//                         <a
//                           href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/address/${sophonAccountAddress}`}
//                           target='_blank'
//                           rel='noreferrer'
//                           className='text-blue-400 hover:underline text-sm break-all'
//                         >
//                           {sophonAccountAddress}
//                         </a>
//                         <p className='text-xs opacity-50 mt-1'>
//                           Also on{' '}
//                           <a
//                             href={`https://sepolia-optimism.etherscan.io/address/${sophonAccountAddress}`}
//                             target='_blank'
//                             rel='noreferrer'
//                             className='text-blue-400 hover:underline'
//                           >
//                             OP Sepolia
//                           </a>
//                         </p>
//                       </div>

//                       {sophonBalance !== null && (
//                         <div>
//                           <p className='text-xs opacity-70 mb-1'>
//                             Sophon Balance
//                           </p>
//                           <p className='text-sm'>{sophonBalance} SOPH</p>
//                         </div>
//                       )}

//                       {eoaAddress && !SOPHON_BUNDLER && (
//                         <div className='p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl text-xs'>
//                           <p className='text-yellow-400 font-semibold mb-2'>
//                             ⚠️ To deploy on Sophon:
//                           </p>
//                           <p className='text-yellow-400 mb-1'>
//                             Fund this EOA address:
//                           </p>
//                           <a
//                             href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/address/${eoaAddress}`}
//                             target='_blank'
//                             rel='noreferrer'
//                             className='text-blue-400 hover:underline break-all'
//                           >
//                             {eoaAddress}
//                           </a>
//                           {eoaSophonBalance !== null && (
//                             <p className='text-yellow-400 mt-2'>
//                               Current balance: {eoaSophonBalance} SOPH
//                             </p>
//                           )}
//                           <p className='text-yellow-400 mt-2'>
//                             Get testnet SOPH from the faucet
//                           </p>
//                         </div>
//                       )}

//                       <button
//                         onClick={deploySophonAccount}
//                         disabled={
//                           loading ||
//                           (!SOPHON_BUNDLER &&
//                             eoaSophonBalance !== null &&
//                             Number(eoaSophonBalance) === 0)
//                         }
//                         className='w-full mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition'
//                       >
//                         {loading
//                           ? 'Deploying...'
//                           : SOPHON_BUNDLER
//                           ? 'Deploy Sophon Account (Gasless)'
//                           : 'Deploy Sophon Account'}
//                       </button>

//                       {sophonTxHash && (
//                         <div>
//                           <p className='text-xs opacity-70 mb-1'>
//                             Sophon Deployment
//                           </p>
//                           <a
//                             href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/tx/${sophonTxHash}`}
//                             target='_blank'
//                             rel='noreferrer'
//                             className='text-blue-400 hover:underline text-sm break-all'
//                           >
//                             {sophonTxHash}
//                           </a>
//                         </div>
//                       )}
//                     </>
//                   )}
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {status && (
//           <div className='w-full max-w-md p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm'>
//             {status}
//           </div>
//         )}

//         {error && (
//           <div className='w-full max-w-md p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm'>
//             <b>Error:</b> {error}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// declare global {
//   interface Window {
//     google?: {
//       accounts: {
//         id: {
//           initialize: (config: any) => void;
//           prompt: () => void;
//           renderButton: (element: HTMLElement, options: any) => void;
//           disableAutoSelect: () => void;
//         };
//       };
//     };
//   }
// }

'use client';

import React, { useState, useEffect } from 'react';
import { http, createPublicClient } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

import {
  createMeeClient,
  getDefaultMeeGasTank,
  getDefaultMEENetworkUrl,
  getMEEVersion,
  MEEVersion,
  toMultichainNexusAccount,
  toNexusAccount,
} from '@biconomy/abstractjs';
import {
  createBundlerClient,
  sendUserOperation,
} from 'viem/account-abstraction';

const IS_STAGING = true;
const STAGING_API_KEY = 'mee_3Zmc7H6Pbd5wUfUGu27aGzdf';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

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

interface UserAccount {
  email: string;
  name: string;
  picture: string;
  privateKey: string;
}

export default function GoogleSmartAccount() {
  const [loading, setLoading] = useState(false);
  const [loadingOpSepolia, setLoadingOpSepolia] = useState(false);
  const [loadingSophon, setLoadingSophon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [googleUser, setGoogleUser] = useState<UserAccount | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );
  const [sophonAccountAddress, setSophonAccountAddress] = useState<
    string | null
  >(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [sophonBalance, setSophonBalance] = useState<string | null>(null);
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);
  const [eoaSophonBalance, setEoaSophonBalance] = useState<string | null>(null);
  const [meeHash, setMeeHash] = useState<string | null>(null);
  const [sophonTxHash, setSophonTxHash] = useState<string | null>(null);

  const OPSP_RPC =
    process.env.NEXT_PUBLIC_OPSP_RPC || 'https://sepolia.optimism.io';
  const SOPHON_RPC = process.env.NEXT_PUBLIC_SOPHON_RPC;
  const SOPHON_BUNDLER = process.env.NEXT_PUBLIC_SOPHON_BUNDLER;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleSignIn,
          ux_mode: 'popup',
        });

        const buttonDiv = document.getElementById('google-signin-button');
        if (buttonDiv && !googleUser) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: 'filled_black',
            size: 'large',
            width: 350,
            text: 'signin_with',
          });
        }
      }
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [googleUser]);

  useEffect(() => {
    const saved = localStorage.getItem('biconomy_google_account');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGoogleUser(parsed);
        restoreSmartAccount(parsed);
      } catch (e) {
        console.error('Failed to parse saved account:', e);
      }
    }
  }, []);

  const handleGoogleSignIn = async (response: any) => {
    try {
      setLoading(true);
      setError(null);
      setStatus('Processing Google sign-in...');

      const credential = response.credential;
      const payload = JSON.parse(atob(credential.split('.')[1]));

      setStatus('Creating deterministic key from Google ID...');

      const deterministicSeed = await deriveKeyFromGoogleId(payload.sub);

      const userAccount: UserAccount = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        privateKey: deterministicSeed,
      };

      setGoogleUser(userAccount);
      localStorage.setItem(
        'biconomy_google_account',
        JSON.stringify(userAccount)
      );

      setStatus('Creating smart account...');
      await createSmartAccount(userAccount);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      console.error('Google sign-in error:', e);
    } finally {
      setLoading(false);
    }
  };

  const deriveKeyFromGoogleId = async (googleSub: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(googleSub);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `0x${hashHex}`;
  };

  const restoreSmartAccount = async (userAccount: UserAccount) => {
    try {
      setLoading(true);
      setStatus('Restoring smart account...');
      await createSmartAccount(userAccount);
    } catch (e: any) {
      console.error('Failed to restore account:', e);
    } finally {
      setLoading(false);
    }
  };

  const createSmartAccount = async (userAccount: UserAccount) => {
    try {
      setStatus('Initializing smart account...');

      const ownerAccount = privateKeyToAccount(
        userAccount.privateKey as `0x${string}`
      );
      setEoaAddress(ownerAccount.address);

      const smartAccount = await toMultichainNexusAccount({
        signer: ownerAccount,
        chainConfigurations: [
          {
            chain: optimismSepolia,
            transport: http(OPSP_RPC),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      const address = await smartAccount.addressOn(optimismSepolia.id);
      if (!address) {
        throw new Error('Failed to get smart account address');
      }

      setSmartAccountAddress(address as string);
      setStatus('Smart account ready!');

      await checkBalance(address as string);
      await checkDeployment(address as string);

      if (SOPHON_RPC) {
        await createSophonAccount(userAccount);
        await checkEoaSophonBalance(ownerAccount.address);
      }
    } catch (e: any) {
      throw new Error(`Smart account creation failed: ${e.message}`);
    }
  };

  const checkBalance = async (address: string) => {
    try {
      const publicClient = createPublicClient({
        chain: optimismSepolia,
        transport: http(OPSP_RPC),
      });

      const bal = await publicClient.getBalance({
        address: address as `0x${string}`,
      });

      setBalance((Number(bal) / 1e18).toFixed(6));
    } catch (e) {
      console.error('Failed to check balance:', e);
    }
  };

  const checkDeployment = async (address: string) => {
    try {
      const publicClient = createPublicClient({
        chain: optimismSepolia,
        transport: http(OPSP_RPC),
      });

      const code = await publicClient.getCode({
        address: address as `0x${string}`,
      });

      const isDeployed = code && code !== '0x';
      if (!isDeployed) {
        setStatus('Smart account ready (not yet deployed on-chain)');
      } else {
        setStatus('✅ Smart account deployed and ready!');
      }
    } catch (e) {
      console.error('Failed to check deployment:', e);
    }
  };

  const createSophonAccount = async (userAccount: UserAccount) => {
    try {
      if (!SOPHON_RPC) return;

      const ownerAccount = privateKeyToAccount(
        userAccount.privateKey as `0x${string}`
      );

      const sophonChain = {
        ...SOPHON_CHAIN,
        rpcUrls: {
          default: { http: [SOPHON_RPC] },
        },
      };

      const nexusAccount = await toNexusAccount({
        signer: ownerAccount,
        chainConfiguration: {
          chain: sophonChain,
          transport: http(SOPHON_RPC),
          version: getMEEVersion(MEEVersion.V2_1_0),
          versionCheck: false,
        },
      });

      const accountAddress = await resolveSophonAddress(nexusAccount);
      if (accountAddress) {
        setSophonAccountAddress(accountAddress);
        await checkSophonBalance(accountAddress);
        await checkSophonDeployment(accountAddress);
      }
    } catch (e) {
      console.error('Failed to create Sophon account:', e);
    }
  };

  const resolveSophonAddress = async (account: any): Promise<string | null> => {
    try {
      const addr =
        (await account.address) ??
        (await account.getAddress?.()) ??
        (account.address as string);
      return addr as string | null;
    } catch (e) {
      console.error('Error resolving Sophon address:', e);
      return null;
    }
  };

  const checkSophonBalance = async (address: string) => {
    try {
      if (!SOPHON_RPC) return;

      const sophonChain = {
        ...SOPHON_CHAIN,
        rpcUrls: {
          default: { http: [SOPHON_RPC] },
        },
      };

      const publicClient = createPublicClient({
        chain: sophonChain,
        transport: http(SOPHON_RPC),
      });

      const bal = await publicClient.getBalance({
        address: address as `0x${string}`,
      });

      setSophonBalance((Number(bal) / 1e18).toFixed(6));
    } catch (e) {
      console.error('Failed to check Sophon balance:', e);
    }
  };

  const checkSophonDeployment = async (address: string) => {
    try {
      if (!SOPHON_RPC) return;

      const sophonChain = {
        ...SOPHON_CHAIN,
        rpcUrls: {
          default: { http: [SOPHON_RPC] },
        },
      };

      const publicClient = createPublicClient({
        chain: sophonChain,
        transport: http(SOPHON_RPC),
      });

      const code = await publicClient.getCode({
        address: address as `0x${string}`,
      });

      const isDeployed = code && code !== '0x';
      if (!isDeployed) {
        console.log('Sophon account not deployed yet');
      } else {
        console.log('Sophon account deployed');
      }
    } catch (e) {
      console.error('Failed to check Sophon deployment:', e);
    }
  };

  const checkEoaSophonBalance = async (address: string) => {
    try {
      if (!SOPHON_RPC) return;

      const sophonChain = {
        ...SOPHON_CHAIN,
        rpcUrls: {
          default: { http: [SOPHON_RPC] },
        },
      };

      const publicClient = createPublicClient({
        chain: sophonChain,
        transport: http(SOPHON_RPC),
      });

      const bal = await publicClient.getBalance({
        address: address as `0x${string}`,
      });

      setEoaSophonBalance((Number(bal) / 1e18).toFixed(6));
    } catch (e) {
      console.error('Failed to check EOA Sophon balance:', e);
    }
  };

  const deployAccount = async () => {
    if (!googleUser || loadingOpSepolia) return;

    try {
      setLoadingOpSepolia(true);
      setError(null);
      setStatus('Deploying smart account on-chain...');

      const ownerAccount = privateKeyToAccount(
        googleUser.privateKey as `0x${string}`
      );

      console.log('add', ownerAccount);
      const smartAccount = await toMultichainNexusAccount({
        signer: ownerAccount,
        chainConfigurations: [
          {
            chain: optimismSepolia,
            transport: http(OPSP_RPC),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      const meeClient = await createMeeClient({
        account: smartAccount,
        url: getDefaultMEENetworkUrl(IS_STAGING),
        apiKey: STAGING_API_KEY,
      });

      const deployInstruction = await smartAccount.build({
        type: 'default',
        data: {
          calls: [
            {
              to: '0x0000000000000000000000000000000000000000',
              value: 0n,
              data: '0x',
              gasLimit: 21000n,
            },
          ],
          chainId: optimismSepolia.id,
        },
      });

      const result = await meeClient.execute({
        instructions: [deployInstruction],
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(IS_STAGING),
          gasTank: getDefaultMeeGasTank(IS_STAGING),
        },
      });

      const hash = (result as any)?.meeHash ?? (result as any)?.hash ?? null;
      if (hash) {
        setMeeHash(hash);
        setStatus('✅ Smart account deployed successfully!');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      console.error('Deployment error:', e);
    } finally {
      setLoadingOpSepolia(false);
    }
  };

  const deploySophonAccount = async () => {
    if (!googleUser || !SOPHON_RPC || !sophonAccountAddress || loadingSophon)
      return;

    try {
      setLoadingSophon(true);
      setError(null);
      setStatus('Deploying Sophon account...');

      const ownerAccount = privateKeyToAccount(
        googleUser.privateKey as `0x${string}`
      );

      const sophonChain = {
        ...SOPHON_CHAIN,
        rpcUrls: {
          default: { http: [SOPHON_RPC] },
        },
      };

      const publicClient = createPublicClient({
        chain: sophonChain,
        transport: http(SOPHON_RPC),
      });

      const code = await publicClient.getCode({
        address: sophonAccountAddress as `0x${string}`,
      });
      const isDeployed = code && code !== '0x';

      if (isDeployed) {
        setStatus('✅ Sophon account already deployed!');
        setLoadingSophon(false);
        return;
      }

      const nexusAccount = await toNexusAccount({
        signer: ownerAccount,
        chainConfiguration: {
          chain: sophonChain,
          transport: http(SOPHON_RPC),
          version: getMEEVersion(MEEVersion.V2_1_0),
          versionCheck: false,
        },
      });

      if (!SOPHON_BUNDLER) {
        try {
          setStatus('Trying bundler deployment...');

          const bundlerClient = createBundlerClient({
            client: publicClient,
            transport: http(SOPHON_BUNDLER),
          });

          const userOpHash = await bundlerClient.sendUserOperation({
            account: nexusAccount as any,
            calls: [
              {
                to: sophonAccountAddress as `0x${string}`,
                value: 0n,
                data: '0x',
              },
            ],
            callGasLimit: 100000n,
            verificationGasLimit: 500000n,
            preVerificationGas: 50000n,
          });

          setSophonTxHash(userOpHash);
          setStatus('Waiting for Sophon deployment...');

          let receipt = null;
          for (let i = 0; i < 30; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const newCode = await publicClient.getCode({
              address: sophonAccountAddress as `0x${string}`,
            });

            if (newCode && newCode !== '0x') {
              receipt = { success: true };
              break;
            }
          }

          if (receipt?.success) {
            setStatus('✅ Sophon account deployed successfully!');
            return;
          } else {
            throw new Error('Bundler timeout');
          }
        } catch (bundlerError) {
          console.log(
            'Bundler failed, trying direct deployment:',
            bundlerError
          );
          setStatus('Bundler failed, trying direct deployment...');
        }
      }

      const eoaBalance = await publicClient.getBalance({
        address: ownerAccount.address,
      });

      if (eoaBalance < 100000000000000n) {
        throw new Error(
          'EOA needs at least 0.0001 SOPH for gas. Please fund: ' +
            ownerAccount.address
        );
      }

      const accountData = nexusAccount as any;
      let factoryData: `0x${string}` | null = null;

      if (accountData.factoryData) {
        factoryData = accountData.factoryData;
      } else if (accountData.getFactoryData) {
        factoryData = await accountData.getFactoryData();
      } else if (accountData.getInitCode) {
        const fullInitCode = await accountData.getInitCode();
        if (fullInitCode.length > 42) {
          factoryData = ('0x' + fullInitCode.slice(42)) as `0x${string}`;
        }
      }

      if (!factoryData) {
        throw new Error('Could not get factory data for deployment');
      }

      const gasPrice = await publicClient.getGasPrice();

      const tx = {
        to: SOPHON_ADDR.NEXUS_FACTORY,
        data: factoryData,
        value: 0n,
        gas: 3000000n,
        gasPrice: gasPrice,
        chainId: SOPHON_ID,
        nonce: await publicClient.getTransactionCount({
          address: ownerAccount.address,
        }),
      };

      const signedTx = await ownerAccount.signTransaction(tx as any);
      const deployHash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTx,
      });

      setSophonTxHash(deployHash);
      setStatus('Waiting for Sophon deployment...');

      const deployReceipt = await publicClient.waitForTransactionReceipt({
        hash: deployHash,
        timeout: 60_000,
      });

      if (deployReceipt.status === 'success') {
        const newCode = await publicClient.getCode({
          address: sophonAccountAddress as `0x${string}`,
        });
        if (!newCode || newCode === '0x') {
          setError('Transaction succeeded but account has no code');
        } else {
          setStatus('✅ Sophon account deployed successfully!');
        }
      } else {
        setError('Sophon deployment transaction failed');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      console.error('Sophon deployment error:', e);
    } finally {
      setLoadingSophon(false);
    }
  };

  const signOut = () => {
    setGoogleUser(null);
    setSmartAccountAddress(null);
    setSophonAccountAddress(null);
    setBalance(null);
    setSophonBalance(null);
    setEoaAddress(null);
    setEoaSophonBalance(null);
    setMeeHash(null);
    setSophonTxHash(null);
    setStatus('');
    setError(null);
    localStorage.removeItem('biconomy_google_account');

    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  return (
    <div className='w-full flex justify-center px-4 py-8'>
      <div className='w-full max-w-2xl flex flex-col items-center gap-6'>
        <div className='text-center'>
          <h1 className='text-3xl font-bold mb-2'>Google Smart Account</h1>
        </div>

        {!googleUser && (
          <div className='w-full max-w-md p-8 bg-neutral-900/50 border border-neutral-700 rounded-2xl'>
            <div className='flex flex-col items-center gap-4'>
              <div className='text-6xl'>🔐</div>
              <h2 className='text-xl font-semibold'>Get Started</h2>
              <p className='text-sm text-center opacity-70'>
                Sign in with your Google account to automatically create a smart
                wallet
              </p>

              {GOOGLE_CLIENT_ID ? (
                <div id='google-signin-button' className='mt-4'></div>
              ) : (
                <div className='mt-4 p-4 bg-orange-900/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm'>
                  <b>⚠️ Configuration Required</b>
                  <p className='mt-2 text-xs'>
                    Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your .env
                    file
                  </p>
                </div>
              )}

              {loading && (
                <div className='text-sm opacity-70'>Processing...</div>
              )}
            </div>
          </div>
        )}

        {googleUser && (
          <div className='w-full max-w-md p-8 bg-neutral-900/50 border border-neutral-700 rounded-2xl'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-3 pb-4 border-b border-neutral-700'>
                {googleUser.picture && (
                  <img
                    src={googleUser.picture}
                    alt={googleUser.name}
                    className='w-12 h-12 rounded-full'
                  />
                )}
                <div className='flex-1'>
                  <p className='font-semibold'>{googleUser.name}</p>
                  <p className='text-sm opacity-70'>{googleUser.email}</p>
                </div>
                <button
                  onClick={signOut}
                  className='text-sm px-3 py-1 rounded-lg border border-neutral-600 hover:bg-neutral-800 transition'
                >
                  Sign Out
                </button>
              </div>

              {smartAccountAddress && (
                <div className='space-y-3'>
                  <div>
                    <p className='text-xs opacity-70 mb-1'>
                      Optimism Sepolia Smart Account
                    </p>
                    <a
                      href={`https://sepolia-optimism.etherscan.io/address/${smartAccountAddress}`}
                      target='_blank'
                      rel='noreferrer'
                      className='text-blue-400 hover:underline text-sm break-all'
                    >
                      {smartAccountAddress}
                    </a>
                    <p className='text-xs opacity-50 mt-1'>
                      Also on{' '}
                      <a
                        href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/address/${smartAccountAddress}`}
                        target='_blank'
                        rel='noreferrer'
                        className='text-blue-400 hover:underline'
                      >
                        Sophon Explorer
                      </a>
                    </p>
                  </div>

                  {balance !== null && (
                    <div>
                      <p className='text-xs opacity-70 mb-1'>
                        OP Sepolia Balance
                      </p>
                      <p className='text-sm'>{balance} ETH</p>
                    </div>
                  )}

                  <button
                    onClick={deployAccount}
                    disabled={loadingOpSepolia}
                    className='w-full mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition'
                  >
                    {loadingOpSepolia
                      ? 'Deploying...'
                      : 'Deploy OP Sepolia Account (Gasless)'}
                  </button>

                  {meeHash && (
                    <div>
                      <p className='text-xs opacity-70 mb-1'>
                        OP Sepolia Deployment
                      </p>
                      <a
                        href={`https://meescan.biconomy.io/details/${meeHash}`}
                        target='_blank'
                        rel='noreferrer'
                        className='text-blue-400 hover:underline text-sm break-all'
                      >
                        {meeHash}
                      </a>
                    </div>
                  )}

                  {sophonAccountAddress && (
                    <>
                      <div className='pt-4 border-t border-neutral-700'>
                        <p className='text-xs opacity-70 mb-1'>
                          Sophon Testnet Smart Account
                        </p>
                        <a
                          href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/address/${sophonAccountAddress}`}
                          target='_blank'
                          rel='noreferrer'
                          className='text-blue-400 hover:underline text-sm break-all'
                        >
                          {sophonAccountAddress}
                        </a>
                        <p className='text-xs opacity-50 mt-1'>
                          Also on{' '}
                          <a
                            href={`https://sepolia-optimism.etherscan.io/address/${sophonAccountAddress}`}
                            target='_blank'
                            rel='noreferrer'
                            className='text-blue-400 hover:underline'
                          >
                            OP Sepolia
                          </a>
                        </p>
                      </div>

                      {sophonBalance !== null && (
                        <div>
                          <p className='text-xs opacity-70 mb-1'>
                            Sophon Balance
                          </p>
                          <p className='text-sm'>{sophonBalance} SOPH</p>
                        </div>
                      )}

                      {eoaAddress && !SOPHON_BUNDLER && (
                        <div className='p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl text-xs'>
                          <p className='text-yellow-400 font-semibold mb-2'>
                            ⚠️ To deploy on Sophon:
                          </p>
                          <p className='text-yellow-400 mb-1'>
                            Fund this EOA address:
                          </p>
                          <a
                            href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/address/${eoaAddress}`}
                            target='_blank'
                            rel='noreferrer'
                            className='text-blue-400 hover:underline break-all'
                          >
                            {eoaAddress}
                          </a>
                          {eoaSophonBalance !== null && (
                            <p className='text-yellow-400 mt-2'>
                              Current balance: {eoaSophonBalance} SOPH
                            </p>
                          )}
                          <p className='text-yellow-400 mt-2'>
                            Get testnet SOPH from the faucet
                          </p>
                        </div>
                      )}

                      <button
                        onClick={deploySophonAccount}
                        disabled={
                          loadingSophon ||
                          (!SOPHON_BUNDLER &&
                            eoaSophonBalance !== null &&
                            Number(eoaSophonBalance) === 0)
                        }
                        className='w-full mt-2 px-4 py-2 rounded-xl border border-neutral-600 disabled:opacity-50 cursor-pointer hover:bg-neutral-800 transition'
                      >
                        {loadingSophon
                          ? 'Deploying...'
                          : SOPHON_BUNDLER
                          ? 'Deploy Sophon Account (Gasless)'
                          : 'Deploy Sophon Account'}
                      </button>

                      {sophonTxHash && (
                        <div>
                          <p className='text-xs opacity-70 mb-1'>
                            Sophon Deployment
                          </p>
                          <a
                            href={`https://block-explorer.zksync-os-testnet-sophon.zksync.dev/tx/${sophonTxHash}`}
                            target='_blank'
                            rel='noreferrer'
                            className='text-blue-400 hover:underline text-sm break-all'
                          >
                            {sophonTxHash}
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {status && (
          <div className='w-full max-w-md p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm'>
            {status}
          </div>
        )}

        {error && (
          <div className='w-full max-w-md p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm'>
            <b>Error:</b> {error}
          </div>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

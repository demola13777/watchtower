import { createPublicClient, http } from 'viem';

const client = createPublicClient({
  transport: http('https://xlayer-mainnet.g.alchemy.com/v2/0oaw1O5w9DNJs2t2TG0yB'),
});

async function run() {
  const USDT_ADDRESS = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';
  const TREASURY = '0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1';
  
  const balance = await client.readContract({
    address: USDT_ADDRESS,
    abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'balanceOf',
    args: [TREASURY],
  });
  
  console.log(`Treasury USDT Balance: ${Number(balance) / 1e6}`);
}
run().catch(console.error);

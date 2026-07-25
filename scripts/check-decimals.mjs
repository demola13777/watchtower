import { createPublicClient, http } from 'viem';

const client = createPublicClient({
  transport: http('https://xlayer-mainnet.g.alchemy.com/v2/0oaw1O5w9DNJs2t2TG0yB'),
});

async function run() {
  const USDT_ADDRESS = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';
  const decimals = await client.readContract({
    address: USDT_ADDRESS,
    abi: [{ name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' }],
    functionName: 'decimals',
  });
  console.log(`USDT Decimals: ${decimals}`);
}
run().catch(console.error);

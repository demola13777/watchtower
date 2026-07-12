import { createPublicClient, http } from 'viem';

const client = createPublicClient({
  transport: http('https://xlayer-mainnet.g.alchemy.com/v2/0oaw1O5w9DNJs2t2TG0yB'),
});

async function main() {
  const balance = await client.readContract({
    address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
    abi: [{
      "constant": true,
      "inputs": [{"name": "_owner", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "balance", "type": "uint256"}],
      "type": "function"
    }],
    functionName: 'balanceOf',
    args: ['0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1']
  });
  console.log("Treasury USDT0 balance:", balance);
}
main().catch(console.error);

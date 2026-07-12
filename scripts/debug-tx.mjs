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
    args: ['0x1bF9f3D8643Ca416878837DF610c9FC8561067b7']
  });
  console.log("Agent USDT0 balance:", balance);
}
main().catch(console.error);

import { createPublicClient, http } from 'viem';

const client = createPublicClient({
  transport: http('https://xlayer-mainnet.g.alchemy.com/v2/0oaw1O5w9DNJs2t2TG0yB'),
});

async function main() {
  const nonce = await client.getTransactionCount({
    address: '0x1bF9f3D8643Ca416878837DF610c9FC8561067b7'
  });
  console.log("Agent Nonce:", nonce);
}
main().catch(console.error);

import { createPublicClient, http, parseAbiItem } from 'viem';

const client = createPublicClient({
  transport: http('https://xlayer-mainnet.g.alchemy.com/v2/0oaw1O5w9DNJs2t2TG0yB'),
});

async function run() {
  const TREASURY = '0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1';
  const USDT_ADDRESS = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';
  
  const transferIn = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
  
  const logsIn = await client.getLogs({
    address: USDT_ADDRESS,
    event: transferIn,
    args: { to: TREASURY },
    fromBlock: 1n,
    toBlock: 'latest'
  });
  
  console.log(`Total inbound transfers: ${logsIn.length}`);
  let totalIn = 0n;
  for (const log of logsIn) {
    totalIn += log.args.value;
  }
  console.log(`Total inbound USDT: ${Number(totalIn) / 1e6}`);

  const logsOut = await client.getLogs({
    address: USDT_ADDRESS,
    event: transferIn,
    args: { from: TREASURY },
    fromBlock: 1n,
    toBlock: 'latest'
  });
  
  console.log(`Total outbound transfers: ${logsOut.length}`);
  let totalOut = 0n;
  for (const log of logsOut) {
    totalOut += log.args.value;
  }
  console.log(`Total outbound USDT: ${Number(totalOut) / 1e6}`);
}
run().catch(console.error);

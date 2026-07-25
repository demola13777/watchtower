import { createPublicClient, http, decodeEventLog } from 'viem';

const client = createPublicClient({
  transport: http('https://xlayer-mainnet.g.alchemy.com/v2/0oaw1O5w9DNJs2t2TG0yB'),
});

async function run() {
  const hashes = [
    '0x6057d525a931c7170f4351532274fe16319cb7c2c23efbc56ca7a4240dde7380',
    '0xbb88bc5c7a5614c422242c0dad241a45b768cb666ae209e39f30896d0652d25d', // Firewall 1
  ];
  
  const erc20TransferAbi = [{
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  }];

  for (const hash of hashes) {
    const receipt = await client.getTransactionReceipt({ hash });
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: erc20TransferAbi, data: log.data, topics: log.topics });
        console.log(`Hash ${hash} from ${decoded.args.from} to ${decoded.args.to} value ${decoded.args.value}`);
      } catch {}
    }
  }
}
run().catch(console.error);

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const SCAN_URL = `${API_URL}/api/scan`;
const TOKEN = process.env.PAYMENT_TEST_TOKEN || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const AGENT = process.env.PAYMENT_TEST_AGENT || '0x0000000000000000000000000000000000000BEE';
const PAYMENT_TEST_TX_HASH = process.env.PAYMENT_TEST_TX_HASH;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeBase64Json(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function postScan(txHash) {
  const headers = { 'Content-Type': 'application/json' };
  if (txHash) headers.Authorization = `L402 ${txHash}`;

  return fetch(SCAN_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tokenAddress: TOKEN, agentWallet: AGENT }),
  });
}

async function main() {
  try {
    await fetch(`${API_URL}/api/telemetry`);
  } catch {
    throw new Error(`WatchTower server is not reachable at ${API_URL}. Start it with: npm run dev`);
  }

  console.log('1. missing Authorization returns HTTP 402 payment requirement');
  const unpaid = await postScan();
  assert(unpaid.status === 402, `Expected 402 without payment, got ${unpaid.status}`);

  const encoded = unpaid.headers.get('PAYMENT-REQUIRED');
  assert(encoded, 'Expected PAYMENT-REQUIRED header');
  const requirement = decodeBase64Json(encoded);

  assert(requirement.scheme === 'evm-erc20-transfer', `Unexpected payment scheme: ${requirement.scheme}`);
  assert(requirement.amount === '0.5', `Expected firewall price 0.5, got ${requirement.amount}`);
  assert(typeof requirement.chainId === 'number', 'Expected numeric chainId');
  assert(/^0x[a-fA-F0-9]{40}$/.test(requirement.tokenAddress || ''), 'Expected token contract address');
  assert(/^0x[a-fA-F0-9]{40}$/.test(requirement.payTo || ''), 'Expected treasury address');

  console.log('2. malformed L402 credential is rejected');
  const malformed = await postScan('0x1234');
  assert(malformed.status === 402, `Expected malformed credential to request payment again, got ${malformed.status}`);

  if (!PAYMENT_TEST_TX_HASH) {
    console.log('3. PAYMENT_TEST_TX_HASH not set; skipping live settlement verification.');
    console.log('Self-hosted x402 challenge tests passed.');
    return;
  }

  console.log('3. valid settlement transaction unlocks scan');
  const paid = await postScan(PAYMENT_TEST_TX_HASH);
  if (paid.status !== 200) {
    throw new Error(`Expected successful paid scan, got ${paid.status}: ${await paid.text()}`);
  }
  assert(paid.headers.get('PAYMENT-RESPONSE'), 'Expected PAYMENT-RESPONSE header');

  console.log('4. replayed settlement transaction is rejected');
  const replay = await postScan(PAYMENT_TEST_TX_HASH);
  assert(replay.status === 409, `Expected replay rejection 409, got ${replay.status}: ${await replay.text()}`);

  console.log('Self-hosted x402 live verification tests passed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const TOKEN_ADDRESS = process.env.NEGATIVE_TEST_TOKEN_ADDRESS
  || process.env.MAINNET_USDT_ADDRESS
  || '0x0000000000000000000000000000000000000001';
const AGENT_WALLET = process.env.AGENT_PAYMENT_ADDRESS
  || '0x0000000000000000000000000000000000000001';

function assert(value, message) {
  if (!value) throw new Error(message);
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeRequirement(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function requestBody() {
  return {
    tokenAddress: TOKEN_ADDRESS,
    chainId: '196',
    agentWallet: AGENT_WALLET,
  };
}

async function createChallenge() {
  const response = await fetch(`${API_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody()),
  });

  assert(response.status === 402, `Expected 402 challenge, received ${response.status}.`);
  const encoded = response.headers.get('PAYMENT-REQUIRED');
  assert(encoded, 'PAYMENT-REQUIRED header is missing.');
  return decodeRequirement(encoded);
}

async function retryWithSignature(paymentSignature) {
  const response = await fetch(`${API_URL}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYMENT-SIGNATURE': paymentSignature,
    },
    body: JSON.stringify(requestBody()),
  });
  return {
    status: response.status,
    body: await response.text(),
  };
}

function fakePaymentPayload(challenge, overrides) {
  return {
    x402Version: challenge.x402Version,
    resource: challenge.resource,
    accepted: {
      ...challenge.accepts[0],
      ...overrides,
    },
    payload: {},
  };
}

async function main() {
  console.log('1. malformed PAYMENT-SIGNATURE is rejected without scan execution');
  let result = await retryWithSignature('not-base64-json');
  assert(result.status === 402, `Expected malformed signature to produce a fresh 402, got ${result.status}.`);

  console.log('2. empty PAYMENT-SIGNATURE is treated as unpaid');
  result = await retryWithSignature('');
  assert(result.status === 402, `Expected empty signature to produce a fresh 402, got ${result.status}.`);

  console.log('3. wrong x402 network is rejected');
  let challenge = await createChallenge();
  result = await retryWithSignature(encode(fakePaymentPayload(challenge, { network: 'eip155:1' })));
  assert(result.status === 401, `Expected wrong-network payload rejection, got ${result.status}: ${result.body}`);

  console.log('4. unsupported x402 scheme is rejected');
  challenge = await createChallenge();
  result = await retryWithSignature(encode(fakePaymentPayload(challenge, { scheme: 'upto' })));
  assert(result.status === 401, `Expected wrong-scheme payload rejection, got ${result.status}: ${result.body}`);

  console.log('Mainnet x402 negative payment checks passed.');
}

main().catch((error) => {
  console.error('Negative payment test failed:', error);
  process.exit(1);
});

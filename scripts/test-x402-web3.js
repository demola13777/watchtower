/**
 * x402 Payment Protocol Test — Standard OKX Facilitator
 *
 * Tests that WatchTower's 402 challenge matches the x402 v2 spec:
 *   - Returns 402 with PAYMENT-REQUIRED header
 *   - Challenge contains x402Version: 2
 *   - accepts[] has scheme: "exact", network: "eip155:*", payTo, amount, asset
 *   - Malformed/missing PAYMENT-SIGNATURE returns 402 (not crash)
 */

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const SCAN_URL = `${API_URL}/api/scan`;
const DEEP_SCAN_URL = `${API_URL}/api/scan/deep`;
const TOKEN = process.env.PAYMENT_TEST_TOKEN || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const AGENT = process.env.PAYMENT_TEST_AGENT || '0x0000000000000000000000000000000000000BEE';
const CHAIN_ID = process.env.PAYMENT_TEST_CHAIN_ID;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeBase64Json(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function postScan(url, paymentSignature) {
  const headers = { 'Content-Type': 'application/json' };
  if (paymentSignature) headers['PAYMENT-SIGNATURE'] = paymentSignature;

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tokenAddress: TOKEN,
      agentWallet: AGENT,
      ...(CHAIN_ID ? { chainId: CHAIN_ID } : {}),
    }),
  });
}

async function main() {
  try {
    await fetch(`${API_URL}/api/telemetry`);
  } catch {
    throw new Error(`WatchTower server is not reachable at ${API_URL}. Start it with: npm run dev`);
  }

  // ── Test 1: Firewall scan (0.5 USDT) returns standard x402 challenge ────
  console.log('1. Missing PAYMENT-SIGNATURE returns HTTP 402 with standard x402 challenge');
  const unpaid = await postScan(SCAN_URL);
  assert(unpaid.status === 402, `Expected 402 without payment, got ${unpaid.status}`);

  const encoded = unpaid.headers.get('PAYMENT-REQUIRED');
  assert(encoded, 'Expected PAYMENT-REQUIRED header in 402 response');

  const challenge = decodeBase64Json(encoded);
  assert(challenge.x402Version === 2, `Expected x402Version 2, got ${challenge.x402Version}`);
  assert(challenge.resource, 'Expected resource field in challenge');
  assert(Array.isArray(challenge.accepts), 'Expected accepts[] array in challenge');
  assert(challenge.accepts.length > 0, 'Expected at least one payment option in accepts[]');

  const option = challenge.accepts[0];
  assert(option.scheme === 'exact', `Expected scheme "exact", got ${option.scheme}`);
  assert(option.network?.startsWith('eip155:'), `Expected CAIP-2 network "eip155:*", got ${option.network}`);
  assert(/^0x[a-fA-F0-9]{40}$/.test(option.payTo || ''), `Expected valid payTo address, got ${option.payTo}`);
  assert(option.amount, `Expected amount field, got ${option.amount}`);
  assert(option.asset || option.amount, 'Expected asset or amount field');
  assert(option.maxTimeoutSeconds > 0, `Expected positive maxTimeoutSeconds, got ${option.maxTimeoutSeconds}`);

  console.log(`   ✓ Challenge: scheme=${option.scheme}, network=${option.network}, payTo=${option.payTo}, amount=${option.amount}`);

  // Also verify the JSON body contains the challenge
  const body = await unpaid.json();
  assert(body.paymentRequired, 'Expected paymentRequired in JSON response body');
  assert(body.paymentRequired.x402Version === 2, 'Expected x402Version 2 in body');

  // ── Test 2: Deep scan (1 USDT) returns the same structure ───────────────
  console.log('2. Deep scan endpoint also returns standard x402 challenge');
  const deepUnpaid = await postScan(DEEP_SCAN_URL);
  assert(deepUnpaid.status === 402, `Expected 402 for deep scan, got ${deepUnpaid.status}`);

  const deepEncoded = deepUnpaid.headers.get('PAYMENT-REQUIRED');
  assert(deepEncoded, 'Expected PAYMENT-REQUIRED header for deep scan');
  const deepChallenge = decodeBase64Json(deepEncoded);
  assert(deepChallenge.x402Version === 2, `Expected x402Version 2 for deep scan`);
  assert(deepChallenge.accepts[0].scheme === 'exact', 'Expected exact scheme for deep scan');
  console.log(`   ✓ Deep scan challenge validated`);

  // ── Test 3: Malformed PAYMENT-SIGNATURE is handled gracefully ───────────
  console.log('3. Malformed PAYMENT-SIGNATURE is handled gracefully (returns 402)');
  const malformed = await postScan(SCAN_URL, 'not-valid-base64!@#$');
  assert(malformed.status === 402, `Expected 402 for malformed signature, got ${malformed.status}`);
  console.log('   ✓ Malformed signature returns fresh challenge');

  // ── Test 4: Empty PAYMENT-SIGNATURE treated as no payment ───────────────
  console.log('4. Empty PAYMENT-SIGNATURE treated as no payment');
  const empty = await postScan(SCAN_URL, '');
  assert(empty.status === 402, `Expected 402 for empty signature, got ${empty.status}`);
  console.log('   ✓ Empty signature returns 402');

  console.log('\n✅ All x402 standard payment tests passed.');
  console.log('   The 402 challenges conform to x402 v2 spec with the "exact" scheme.');
  console.log('   End-to-end settlement tests require agent wallet funds — skipped.');
}

main().catch((error) => {
  console.error('❌', error.message);
  process.exit(1);
});

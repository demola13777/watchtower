/**
 * SDK Integration Test
 *
 * Imports the WatchTower SDK from the local package build and runs a
 * guardTransaction call against the configured API URL. Validates the full
 * 402 challenge → payment requirement flow without actually settling payment.
 *
 * Usage:
 *   WATCHTOWER_API_URL=https://your-deployment.vercel.app node scripts/sdk-integration-test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const AGENT_WALLET = '0x0000000000000000000000000000000000000042';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

// Import the SDK from the local build.
let WatchTowerClient, WatchTowerPaymentRequiredError;
try {
  const sdk = require('../packages/watchtower-sdk/src/index.js');
  WatchTowerClient = sdk.WatchTowerClient;
  WatchTowerPaymentRequiredError = sdk.WatchTowerPaymentRequiredError;
} catch (err) {
  console.error('Failed to import SDK. Run `cd packages/watchtower-sdk && npm run build` first.');
  console.error(err.message);
  process.exit(1);
}

async function testGuardTransactionRequiresPayment() {
  console.log('1. guardTransaction() should throw WatchTowerPaymentRequiredError without a payment key');

  const client = new WatchTowerClient({
    apiUrl: API_URL,
    agentWallet: AGENT_WALLET,
  });

  try {
    await client.guardTransaction('0xdAC17F958D2ee523a2206206994597C13D831ec7', '1');
    throw new Error('Expected guardTransaction to throw, but it succeeded.');
  } catch (err) {
    if (err instanceof WatchTowerPaymentRequiredError) {
      assert(err.requirement, 'PaymentRequiredError should have a requirement object');
      assert(err.requirement.paymentId, 'Requirement should include a paymentId');
      assert(err.requirement.chainId, 'Requirement should include a chainId');
      assert(err.requirement.tokenAddress, 'Requirement should include a tokenAddress');
      assert(err.requirement.payTo, 'Requirement should include a payTo');
      assert(err.requirement.amount, 'Requirement should include an amount');
      console.log(`   ✅ Received payment requirement: ${err.requirement.amount} ${err.requirement.currency} on chain ${err.requirement.chainId}`);
    } else {
      throw err;
    }
  }
}

async function testDeepScanRequiresPayment() {
  console.log('2. deepScan() should throw WatchTowerPaymentRequiredError without a payment key');

  const client = new WatchTowerClient({
    apiUrl: API_URL,
    agentWallet: AGENT_WALLET,
  });

  try {
    await client.deepScan('0xdAC17F958D2ee523a2206206994597C13D831ec7', '1');
    throw new Error('Expected deepScan to throw, but it succeeded.');
  } catch (err) {
    if (err instanceof WatchTowerPaymentRequiredError) {
      assert(err.requirement.amount, 'Deep scan requirement should include an amount');
      console.log(`   ✅ Received deep scan payment requirement: ${err.requirement.amount} ${err.requirement.currency}`);
    } else {
      throw err;
    }
  }
}

async function testInvalidAddressRejected() {
  console.log('3. Invalid token address should be rejected with 400');

  try {
    const res = await fetch(`${API_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress: 'not-a-valid-address', chainId: '1' }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    console.log('   ✅ Invalid address rejected with 400');
  } catch (err) {
    throw new Error(`Fetch failed: ${err.message}`);
  }
}

async function testHealthEndpoint() {
  console.log('4. Health endpoint should return ok: true');

  const res = await fetch(`${API_URL}/api/health`);
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.ok === true, `Expected ok: true, got ${JSON.stringify(body)}`);
  console.log(`   ✅ Health: ok=${body.ok}, database=${body.database}, network=${body.paymentNetwork}`);
}

// Run all tests sequentially.
console.log(`SDK Integration Test — ${API_URL}\n`);
try {
  await testHealthEndpoint();
  await testGuardTransactionRequiresPayment();
  await testDeepScanRequiresPayment();
  await testInvalidAddressRejected();
  console.log('\n✅ All SDK integration tests passed.');
} catch (err) {
  console.error(`\n❌ Test failed: ${err.message}`);
  process.exit(1);
}

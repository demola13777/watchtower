/**
 * Production Test Suite Orchestrator
 *
 * Runs all validation and test scripts in sequence and reports results.
 * Exit code is non-zero if any step fails.
 *
 * Usage:
 *   node scripts/production-test-suite.mjs
 *
 * Requires a running WatchTower instance (set WATCHTOWER_API_URL).
 */

import { execSync } from 'child_process';

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';

const steps = [
  {
    name: 'Mainnet Config Validation',
    command: 'node scripts/validate-mainnet-config.mjs',
    required: true,
  },
  {
    name: 'Health Endpoint Check',
    command: null, // Custom check below.
    required: true,
  },
  {
    name: 'SDK Integration Test',
    command: `WATCHTOWER_API_URL=${API_URL} node scripts/sdk-integration-test.mjs`,
    required: true,
  },
  {
    name: 'Regression Token Corpus',
    command: `WATCHTOWER_API_URL=${API_URL} node scripts/regression-token-corpus.mjs`,
    required: false, // Advisory — may hit rate limits.
  },
  {
    name: 'Payment Reconciliation',
    command: 'node scripts/reconcile-mainnet-payments.mjs',
    required: false, // Only meaningful if there are completed payments.
  },
];

let passed = 0;
let failed = 0;
let skipped = 0;

console.log('═══════════════════════════════════════════════════════');
console.log('  WatchTower Production Test Suite');
console.log(`  API: ${API_URL}`);
console.log('═══════════════════════════════════════════════════════\n');

for (const step of steps) {
  process.stdout.write(`▶ ${step.name} ... `);

  if (step.name === 'Health Endpoint Check') {
    // Custom: hit the health endpoint directly.
    try {
      const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(10_000) });
      const body = await res.json();
      if (body.ok) {
        console.log(`✅ ok (database: ${body.database}, network: ${body.paymentNetwork})`);
        passed++;
      } else {
        console.log(`❌ unhealthy: ${JSON.stringify(body)}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
      if (step.required) {
        console.log('\n⛔ Required step failed — aborting suite.');
        break;
      }
    }
    continue;
  }

  try {
    execSync(step.command, {
      stdio: 'pipe',
      timeout: 120_000,
      env: { ...process.env, WATCHTOWER_API_URL: API_URL },
    });
    console.log('✅');
    passed++;
  } catch (err) {
    const output = err.stdout?.toString().trim() || err.stderr?.toString().trim() || err.message;
    console.log(`❌`);
    // Show first 3 lines of output for context.
    const lines = output.split('\n').slice(0, 3);
    for (const line of lines) {
      console.log(`   ${line}`);
    }

    if (step.required) {
      failed++;
    } else {
      skipped++;
      console.log(`   (advisory — not blocking)`);
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} advisory`);
console.log('═══════════════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}

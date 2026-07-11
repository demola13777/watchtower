/**
 * Load Test — Key WatchTower Routes
 *
 * Sends concurrent requests to the health, telemetry, and scan (402 challenge)
 * endpoints to validate stability under load.
 *
 * Usage:
 *   WATCHTOWER_API_URL=https://your-deployment.vercel.app node scripts/load-test.mjs
 *
 * Options (via env):
 *   LOAD_TEST_CONCURRENCY  — concurrent requests per batch (default: 20)
 *   LOAD_TEST_BATCHES      — number of batches to run (default: 5)
 */

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || '20');
const BATCHES = Number(process.env.LOAD_TEST_BATCHES || '5');

const stats = {
  health: { ok: 0, fail: 0, totalMs: 0 },
  telemetry: { ok: 0, fail: 0, totalMs: 0 },
  scan402: { ok: 0, fail: 0, totalMs: 0 },
};

async function timedFetch(url, options) {
  const start = performance.now();
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
    const elapsed = Math.round(performance.now() - start);
    return { status: res.status, elapsed };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { status: 0, elapsed, error: err.message };
  }
}

async function runBatch(batchIndex) {
  const requests = [];

  // 40% health, 30% telemetry, 30% scan 402 challenge
  const healthCount = Math.ceil(CONCURRENCY * 0.4);
  const telemetryCount = Math.ceil(CONCURRENCY * 0.3);
  const scanCount = CONCURRENCY - healthCount - telemetryCount;

  for (let i = 0; i < healthCount; i++) {
    requests.push(
      timedFetch(`${API_URL}/api/health`).then((r) => {
        if (r.status === 200) { stats.health.ok++; } else { stats.health.fail++; }
        stats.health.totalMs += r.elapsed;
        return r;
      }),
    );
  }

  for (let i = 0; i < telemetryCount; i++) {
    requests.push(
      timedFetch(`${API_URL}/api/telemetry`).then((r) => {
        if (r.status === 200) { stats.telemetry.ok++; } else { stats.telemetry.fail++; }
        stats.telemetry.totalMs += r.elapsed;
        return r;
      }),
    );
  }

  for (let i = 0; i < scanCount; i++) {
    requests.push(
      timedFetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: '1',
        }),
      }).then((r) => {
        // 402 is the expected response (payment required).
        // 429 means rate limited — counts as "ok" since it means the limiter works.
        if (r.status === 402 || r.status === 429) { stats.scan402.ok++; } else { stats.scan402.fail++; }
        stats.scan402.totalMs += r.elapsed;
        return r;
      }),
    );
  }

  const results = await Promise.all(requests);
  const maxMs = Math.max(...results.map((r) => r.elapsed));
  const minMs = Math.min(...results.map((r) => r.elapsed));
  console.log(`  Batch ${batchIndex + 1}/${BATCHES}: ${CONCURRENCY} requests, ${minMs}-${maxMs}ms range`);
}

console.log(`Load testing ${API_URL}`);
console.log(`Concurrency: ${CONCURRENCY}, Batches: ${BATCHES}\n`);

for (let i = 0; i < BATCHES; i++) {
  await runBatch(i);
  // Brief cooldown between batches.
  if (i < BATCHES - 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

console.log('\n--- Results ---');
for (const [route, s] of Object.entries(stats)) {
  const total = s.ok + s.fail;
  const avgMs = total > 0 ? Math.round(s.totalMs / total) : 0;
  const failRate = total > 0 ? ((s.fail / total) * 100).toFixed(1) : '0.0';
  console.log(`${route}: ${s.ok}/${total} ok, ${failRate}% fail, avg ${avgMs}ms`);
}

const totalFail = stats.health.fail + stats.telemetry.fail + stats.scan402.fail;
if (totalFail > 0) {
  console.log(`\n⚠️  ${totalFail} request(s) failed.`);
  process.exit(1);
} else {
  console.log('\n✅ All requests succeeded.');
}

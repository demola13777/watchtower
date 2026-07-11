/**
 * MCP Agent Demo — "The Wow Factor"
 *
 * Demonstrates an AI agent connecting to WatchTower via MCP protocol
 * and scanning a token for threats before executing a trade.
 *
 * Usage:
 *   1. Start the WatchTower dev server: cd watchtower && npm run dev
 *   2. Run this script: node demo/mcp-agent.js
 *
 * This script sends raw JSON-RPC messages to the MCP endpoint.
 * In production, an AI agent (Claude, Cursor, OpenClaw) would use
 * the MCP client SDK to discover and invoke these tools automatically.
 */
const MCP_ENDPOINT = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const MCP_URL = `${MCP_ENDPOINT}/api/mcp`;
const PAYER = '0x0000000000000000000000000000000000000C99';
const ACTIVE_CHAIN_ID = process.env.WATCHTOWER_DEMO_CHAIN_ID
  || (process.env.NEXT_PUBLIC_NETWORK_ENV === 'mainnet' ? '196' : '1952');
const PAYMENT_TEST_TX_HASHES = (process.env.PAYMENT_TEST_TX_HASHES || process.env.PAYMENT_TEST_TX_HASH || '')
  .split(',')
  .map((hash) => hash.trim())
  .filter(Boolean);
const PAYMENT_TEST_PAYMENT_IDS = (process.env.PAYMENT_TEST_PAYMENT_IDS || process.env.PAYMENT_TEST_PAYMENT_ID || '')
  .split(',')
  .map((paymentId) => paymentId.trim())
  .filter(Boolean);
let paymentHashIndex = 0;

// Override this with WATCHTOWER_DEMO_TOKEN when running against a specific network.
const MALICIOUS_TOKEN = '0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D';
// Known safe token (USDT on Ethereum mainnet)
const SAFE_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

function decodeBase64Json(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function sendMcpRequest(method, params, id) {
  const body = {
    jsonrpc: '2.0',
    method,
    params,
    id,
  };

  const requestBody = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (method === 'tools/call' && PAYMENT_TEST_TX_HASHES[paymentHashIndex]) {
    headers.Authorization = `L402 ${PAYMENT_TEST_TX_HASHES[paymentHashIndex]}`;
    if (PAYMENT_TEST_PAYMENT_IDS[paymentHashIndex]) {
      headers['X-WatchTower-Payment-Id'] = PAYMENT_TEST_PAYMENT_IDS[paymentHashIndex];
    }
    paymentHashIndex += 1;
  }

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: requestBody,
  });

  if (res.status === 402) {
    const encodedRequirement = res.headers.get('PAYMENT-REQUIRED');
    const requirement = encodedRequirement ? decodeBase64Json(encodedRequirement) : (await res.json()).paymentRequired;
    throw new Error(
      `Payment required: send ${requirement.amount} ${requirement.currency} to ${requirement.payTo} on chain ${requirement.chainId}, then retry this exact request with PAYMENT_TEST_TX_HASHES and PAYMENT_TEST_PAYMENT_IDS. Payment id: ${requirement.paymentId}`,
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP request failed (${res.status}): ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    // Parse SSE response
    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          return JSON.parse(line.slice(6));
        } catch {
          // Continue to next data line
        }
      }
    }
    throw new Error('No valid JSON-RPC response found in SSE stream');
  }

  return await res.json();
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          🤖 MCP Agent Demo — WatchTower Integration      ║');
  console.log('║          Model Context Protocol (Streamable HTTP)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Initialize MCP session
  console.log('📡 Step 1: Initializing MCP connection...');
  try {
    const initResult = await sendMcpRequest('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'trading-agent-alpha', version: '1.0.0' },
    }, 1);
    console.log(`   ✅ Connected to: ${initResult.result?.serverInfo?.name} v${initResult.result?.serverInfo?.version}`);
    console.log(`   📋 Protocol: ${initResult.result?.protocolVersion}`);
  } catch (err) {
    console.error(`   ❌ Connection failed: ${err.message}`);
    console.error('   💡 Make sure the WatchTower dev server is running: npm run dev');
    process.exit(1);
  }

  // Send initialized notification
  await sendMcpRequest('notifications/initialized', {}, undefined).catch(() => {});

  // Step 2: Discover available tools
  console.log('\n🔍 Step 2: Discovering WatchTower tools...');
  const toolsResult = await sendMcpRequest('tools/list', {}, 2);
  const tools = toolsResult.result?.tools || [];
  console.log(`   Found ${tools.length} tools:`);
  for (const tool of tools) {
    console.log(`   ► ${tool.name}: ${tool.description?.substring(0, 80)}...`);
  }

  // Step 3: Scan the malicious token
  console.log(`\n🛡️  Step 3: Scanning MALICIOUS token ${MALICIOUS_TOKEN.substring(0, 10)}...`);
  console.log('   ⏳ Running threat analysis...');
  const maliciousScan = await sendMcpRequest('tools/call', {
    name: 'scan_token',
    arguments: {
      tokenAddress: MALICIOUS_TOKEN,
      chainId: ACTIVE_CHAIN_ID,
      agentWallet: PAYER,
    },
  }, 3);

  const maliciousData = JSON.parse(maliciousScan.result?.content?.[0]?.text || '{}');

  if (maliciousData.error) {
    console.log(`   ❌ Scan error: ${maliciousData.error}`);
  } else {
    const emoji = maliciousData.recommendation === 'ABORT' ? '🛑' : maliciousData.recommendation === 'CAUTION' ? '⚠️' : '✅';
    console.log(`   ${emoji} Threat Score: ${maliciousData.threatScore}/100`);
    console.log(`   📊 Confidence: ${(maliciousData.confidence * 100).toFixed(0)}%`);
    console.log(`   🎯 Recommendation: ${maliciousData.recommendation}`);
    console.log('   📋 Signals:');
    (maliciousData.reasoning || []).forEach(r => {
      console.log(`      ${r.includes('CRITICAL') || r.includes('🚨') ? '❌' : '•'} ${r}`);
    });

    if (maliciousData.recommendation === 'ABORT') {
      console.log('\n   ╔════════════════════════════════════════════════╗');
      console.log('   ║  🛑 TRADE BLOCKED — Agent protected from loss  ║');
      console.log('   ╚════════════════════════════════════════════════╝');
    }
  }

  // Step 4: Scan a safe token for comparison
  console.log(`\n✅ Step 4: Scanning SAFE token (USDT) ${SAFE_TOKEN.substring(0, 10)}...`);
  console.log('   ⏳ Running threat analysis...');
  const safeScan = await sendMcpRequest('tools/call', {
    name: 'scan_token',
    arguments: {
      tokenAddress: SAFE_TOKEN,
      chainId: '1',
      agentWallet: PAYER,
    },
  }, 4);

  const safeData = JSON.parse(safeScan.result?.content?.[0]?.text || '{}');

  if (safeData.error) {
    console.log(`   ❌ Scan error: ${safeData.error}`);
  } else {
    const emoji = safeData.recommendation === 'ABORT' ? '🛑' : safeData.recommendation === 'CAUTION' ? '⚠️' : '✅';
    console.log(`   ${emoji} Threat Score: ${safeData.threatScore}/100`);
    console.log(`   📊 Confidence: ${(safeData.confidence * 100).toFixed(0)}%`);
    console.log(`   🎯 Recommendation: ${safeData.recommendation}`);
    console.log('   📋 Signals:');
    (safeData.reasoning || []).forEach(r => {
      console.log(`      • ${r}`);
    });

    if (safeData.recommendation === 'TRADE') {
      console.log('\n   ╔════════════════════════════════════════════════╗');
      console.log('   ║  ✅ TRADE APPROVED — Agent proceeding safely   ║');
      console.log('   ╚════════════════════════════════════════════════╝');
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Demo complete. The MCP protocol enables ANY AI agent');
  console.log('  to discover and invoke WatchTower threat intelligence.');
  console.log('  Add mcp-config.json to your agent\'s MCP config to start.');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Demo failed:', err);
  process.exit(1);
});

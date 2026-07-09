// The live honeypot contract on X Layer Testnet
const targetToken = "0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D";
const targetChainId = "1952";
const payer = "0x0000000000000000000000000000000000000D99";

// L5: Configurable API URL
const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const PAYMENT_TEST_TX_HASH = process.env.PAYMENT_TEST_TX_HASH;

function decodeBase64Json(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function runDeepScan() {
  console.log("🔍 Initializing WatchTower Deep Scan (Tier 1)...");
  console.log(`💸 Using self-hosted x402 verification on X Layer testnet...`);
  
  try {
    const body = JSON.stringify({
      tokenAddress: targetToken,
      chainId: targetChainId,
      agentWallet: payer
    });
    const headers = { "Content-Type": "application/json" };
    if (PAYMENT_TEST_TX_HASH) headers.Authorization = `L402 ${PAYMENT_TEST_TX_HASH}`;

    const response = await fetch(`${API_URL}/api/scan/deep`, {
      method: "POST",
      headers,
      body,
    });

    if (response.status === 402) {
      const encodedRequirement = response.headers.get('PAYMENT-REQUIRED');
      const requirement = encodedRequirement ? decodeBase64Json(encodedRequirement) : (await response.json()).paymentRequired;
      console.log('\n💳 Payment required before scan execution:');
      console.log(`   Amount   : ${requirement.amount} ${requirement.currency}`);
      console.log(`   Chain ID : ${requirement.chainId}`);
      console.log(`   Token    : ${requirement.tokenAddress}`);
      console.log(`   Treasury : ${requirement.payTo}`);
      console.log('\nSend the payment, then rerun with PAYMENT_TEST_TX_HASH=<tx_hash>.');
      return;
    }

    const data = await response.json();
    
    if (data.success) {
      const report = data.data;
      
      console.log(`\n======================================================`);
      console.log(`✅ DEEP SCAN COMPLETE`);
      console.log(`======================================================`);
      console.log(`Target Address : ${report.tokenAddress}`);
      console.log(`Chain ID       : ${report.chainId}`);
      console.log(`Verdict        : ${report.verdict.recommendation}`);
      console.log(`Threat Score   : ${report.verdict.threatScore}/100`);
      console.log(`Confidence     : ${(report.verdict.confidence * 100).toFixed(0)}%`);
      
      console.log(`\n======================================================`);
      console.log(`💎 PREMIUM REPORT GENERATED`);
      console.log(`======================================================`);
      console.log(`View your full intelligence breakdown online:`);
      console.log(`👉 ${API_URL}/report/${report.verification.scanHash}\n`);
    } else {
      console.error("\n❌ Scan failed:", data);
    }
  } catch (err) {
    console.error("Error connecting to WatchTower API:", err.message);
  }
}

runDeepScan();

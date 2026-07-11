import nextEnv from '@next/env';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const API_URL = process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
const CONFIRMATION_FLAG = process.env.CONFIRM_MAINNET_NEGATIVE_PAYMENT_TESTS;
const TOKEN_ADDRESS = process.env.MAINNET_USDT_ADDRESS;
const TREASURY_ADDRESS = process.env.MAINNET_TREASURY_ADDRESS;
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const RPC_URL = process.env.MAINNET_RPC_URL;
const PRIVATE_KEY = process.env.AGENT_PAYMENT_KEY;
const EXPECTED_AGENT = process.env.AGENT_PAYMENT_ADDRESS;
const DECIMALS = Number(process.env.MAINNET_PAYMENT_TOKEN_DECIMALS);
const MIN_CONFIRMATIONS = Number(process.env.PAYMENT_MIN_CONFIRMATIONS);
const WRONG_CHAIN_TX = process.env.NEGATIVE_TEST_WRONG_CHAIN_TX_HASH;
const WRONG_ASSET_TX = process.env.NEGATIVE_TEST_WRONG_ASSET_TX_HASH;
const START_AT_STEP = Number(process.env.NEGATIVE_TEST_START_AT_STEP || '1');

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)']);
const amount = parseUnits('0.01', DECIMALS);

function required(value, name) {
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function decodeRequirement(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

const requestBody = (agentWallet) => ({
  tokenAddress: TOKEN_ADDRESS,
  chainId: '196',
  agentWallet,
});

async function createIntent(agentWallet) {
  const response = await fetch(`${API_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody(agentWallet)),
  });
  assert(response.status === 402, `Expected fresh payment intent, received ${response.status}.`);
  const encoded = response.headers.get('PAYMENT-REQUIRED');
  assert(encoded, 'Payment requirement header is missing.');
  return decodeRequirement(encoded);
}

async function retryIntent(agentWallet, requirement, txHash) {
  const response = await fetch(`${API_URL}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `L402 ${txHash}`,
      'X-WatchTower-Payment-Id': requirement.paymentId,
    },
    body: JSON.stringify(requestBody(agentWallet)),
  });
  return { status: response.status, body: await response.text() };
}

async function waitForConfirmations(client, blockNumber) {
  const target = blockNumber + BigInt(MIN_CONFIRMATIONS - 1);
  while (await client.getBlockNumber() < target) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
}

async function main() {
  assert(CONFIRMATION_FLAG === 'true', 'Set CONFIRM_MAINNET_NEGATIVE_PAYMENT_TESTS=true only after approving the three Mainnet test transactions.');
  required(TOKEN_ADDRESS, 'MAINNET_USDT_ADDRESS');
  required(TREASURY_ADDRESS, 'MAINNET_TREASURY_ADDRESS');
  required(REGISTRY_ADDRESS, 'NEXT_PUBLIC_REGISTRY_ADDRESS');
  required(RPC_URL, 'MAINNET_RPC_URL');
  required(PRIVATE_KEY, 'AGENT_PAYMENT_KEY');
  required(EXPECTED_AGENT, 'AGENT_PAYMENT_ADDRESS');
  required(WRONG_CHAIN_TX, 'NEGATIVE_TEST_WRONG_CHAIN_TX_HASH');
  required(WRONG_ASSET_TX, 'NEGATIVE_TEST_WRONG_ASSET_TX_HASH');
  assert(Number.isInteger(DECIMALS) && DECIMALS >= 0, 'MAINNET_PAYMENT_TOKEN_DECIMALS is invalid.');
  assert(Number.isInteger(MIN_CONFIRMATIONS) && MIN_CONFIRMATIONS >= 2, 'PAYMENT_MIN_CONFIRMATIONS must be at least 2.');
  assert(Number.isInteger(START_AT_STEP) && START_AT_STEP >= 1 && START_AT_STEP <= 5, 'NEGATIVE_TEST_START_AT_STEP must be between 1 and 5.');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  assert(account.address.toLowerCase() === EXPECTED_AGENT.toLowerCase(), 'AGENT_PAYMENT_KEY does not match AGENT_PAYMENT_ADDRESS.');

  const client = createPublicClient({ transport: http(RPC_URL) });
  assert(await client.getChainId() === 196, 'MAINNET_RPC_URL did not resolve X Layer Mainnet chain 196.');
  const chain = defineChain({
    id: 196,
    name: 'X Layer Mainnet',
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  });
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });
  const tokenBalance = await client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
  assert(tokenBalance >= amount * 2n, 'Agent wallet needs at least 0.02 USDT0 for the approved negative payment checks.');

  let requirement;
  let result;

  if (START_AT_STEP <= 1) {
    console.log('1. wrong-chain transaction is rejected');
    requirement = await createIntent(account.address);
    result = await retryIntent(account.address, requirement, WRONG_CHAIN_TX);
    assert(result.status === 401, `Expected wrong-chain transaction rejection, got ${result.status}.`);
  } else {
    console.log('1. wrong-chain transaction is rejected [skipped by NEGATIVE_TEST_START_AT_STEP]');
  }

  if (START_AT_STEP <= 2) {
    console.log('2. wrong-asset transaction is rejected');
    requirement = await createIntent(account.address);
    result = await retryIntent(account.address, requirement, WRONG_ASSET_TX);
    assert(result.status === 401, `Expected wrong-asset transaction rejection, got ${result.status}.`);
  } else {
    console.log('2. wrong-asset transaction is rejected [skipped by NEGATIVE_TEST_START_AT_STEP]');
  }

  if (START_AT_STEP <= 3) {
    console.log('3. below-confirmation and insufficient-payment transaction is rejected');
    requirement = await createIntent(account.address);
    const insufficientTx = await wallet.writeContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [TREASURY_ADDRESS, amount],
    });
    const insufficientReceipt = await client.waitForTransactionReceipt({ hash: insufficientTx });
    assert(insufficientReceipt.status === 'success', 'Insufficient-payment transfer did not mine successfully.');
    result = await retryIntent(account.address, requirement, insufficientTx);
    assert(result.status === 401, `Expected below-confirmation rejection, got ${result.status}.`);
    await waitForConfirmations(client, insufficientReceipt.blockNumber);
    result = await retryIntent(account.address, requirement, insufficientTx);
    assert(result.status === 401 && /amount too low/i.test(result.body), 'Expected insufficient amount rejection after confirmation.');
  } else {
    console.log('3. below-confirmation and insufficient-payment transaction is rejected [skipped by NEGATIVE_TEST_START_AT_STEP]');
  }

  if (START_AT_STEP <= 4) {
    console.log('4. correct-token transfer to the wrong recipient is rejected');
    requirement = await createIntent(account.address);
    const wrongTreasuryTx = await wallet.writeContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [account.address, amount],
    });
    const wrongTreasuryReceipt = await client.waitForTransactionReceipt({ hash: wrongTreasuryTx });
    assert(wrongTreasuryReceipt.status === 'success', 'Wrong-recipient transfer did not mine successfully.');
    await waitForConfirmations(client, wrongTreasuryReceipt.blockNumber);
    result = await retryIntent(account.address, requirement, wrongTreasuryTx);
    assert(result.status === 401 && /no valid/i.test(result.body), 'Expected wrong-recipient rejection.');
  } else {
    console.log('4. correct-token transfer to the wrong recipient is rejected [skipped by NEGATIVE_TEST_START_AT_STEP]');
  }

  console.log('5. failed transaction is rejected');
  requirement = await createIntent(account.address);
  const failedTx = await wallet.sendTransaction({ to: REGISTRY_ADDRESS, data: '0xdeadbeef', value: 0n, gas: 100_000n });
  const failedReceipt = await client.waitForTransactionReceipt({ hash: failedTx });
  assert(failedReceipt.status === 'reverted', 'Expected deliberately invalid registry call to revert.');
  result = await retryIntent(account.address, requirement, failedTx);
  assert(result.status === 401, `Expected failed transaction rejection, got ${result.status}.`);

  console.log('Mainnet negative payment checks passed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import {
  createPublicClient,
  decodeEventLog,
  http,
  formatUnits,
  parseAbiItem,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { getRequiredPaymentNetwork } from '@/config/network';

const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

export interface PaymentVerificationInput {
  txHash: string;
  requiredAmount: string;
}

export interface PaymentVerificationSuccess {
  ok: true;
  txHash: Hex;
  chainId: number;
  payer: Address;
  recipient: Address;
  tokenAddress: Address;
  amount: bigint;
  amountFormatted: string;
  blockNumber: bigint;
}

export interface PaymentVerificationFailure {
  ok: false;
  reason: string;
}

export type PaymentVerificationResult = PaymentVerificationSuccess | PaymentVerificationFailure;

function isHexTxHash(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function getMinConfirmations(): bigint {
  const configured = process.env.PAYMENT_MIN_CONFIRMATIONS;
  const zero = BigInt(0);
  if (!configured) return zero;
  const parsed = BigInt(configured);
  return parsed < zero ? zero : parsed;
}

export async function verifyPaymentTransaction({
  txHash,
  requiredAmount,
}: PaymentVerificationInput): Promise<PaymentVerificationResult> {
  if (!isHexTxHash(txHash)) {
    return { ok: false, reason: 'Invalid transaction hash format.' };
  }

  const network = getRequiredPaymentNetwork();
  const client = createPublicClient({
    transport: http(network.rpcUrl),
  });

  let chainId: number;
  try {
    chainId = await client.getChainId();
  } catch {
    return { ok: false, reason: 'Unable to connect to the configured payment RPC.' };
  }

  if (chainId !== network.chainId) {
    return {
      ok: false,
      reason: `Payment chain mismatch. Expected ${network.chainId}, got ${chainId}.`,
    };
  }

  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) {
    return { ok: false, reason: 'Payment transaction was not found on the configured chain.' };
  }

  if (receipt.status !== 'success') {
    return { ok: false, reason: 'Payment transaction was not successfully mined.' };
  }

  const minConfirmations = getMinConfirmations();
  if (minConfirmations > BigInt(0)) {
    const currentBlock = await client.getBlockNumber().catch(() => null);
    if (currentBlock === null) {
      return { ok: false, reason: 'Unable to verify payment confirmation depth.' };
    }
    const confirmations = currentBlock >= receipt.blockNumber
      ? currentBlock - receipt.blockNumber + BigInt(1)
      : BigInt(0);
    if (confirmations < minConfirmations) {
      return {
        ok: false,
        reason: `Payment transaction has ${confirmations.toString()} confirmation(s); ${minConfirmations.toString()} required.`,
      };
    }
  }

  const tokenAddress = network.token.address.toLowerCase();
  const treasuryAddress = network.treasuryAddress.toLowerCase();
  const requiredBaseUnits = parseUnits(requiredAmount, network.token.decimals);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress) continue;

    try {
      const decoded = decodeEventLog({
        abi: [transferEvent],
        data: log.data,
        topics: log.topics,
      });

      const args = decoded.args as { from?: Address; to?: Address; value?: bigint };
      if (!args.to || !args.value || !args.from) continue;
      if (args.to.toLowerCase() !== treasuryAddress) continue;
      if (args.value < requiredBaseUnits) {
        return {
          ok: false,
          reason: `Payment amount too low. Required ${requiredAmount} ${network.token.symbol}.`,
        };
      }

      return {
        ok: true,
        txHash,
        chainId,
        payer: args.from,
        recipient: args.to,
        tokenAddress: network.token.address,
        amount: args.value,
        amountFormatted: formatUnits(args.value, network.token.decimals),
        blockNumber: receipt.blockNumber,
      };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    reason: `No valid ${network.token.symbol} transfer to treasury was found in this transaction.`,
  };
}

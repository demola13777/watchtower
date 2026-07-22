import { z } from 'zod';

const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const chainIdRegex = /^[0-9]+$/;
const hexRegex = /^0x[a-fA-F0-9]*$/;
const bytes32Regex = /^0x[a-fA-F0-9]{64}$/;

export const tokenAddressSchema = z
  .string()
  .trim()
  .regex(evmAddressRegex, 'Invalid tokenAddress format. Expected 0x-prefixed 40-char hex address.');

export const chainIdSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)))
  .refine((value) => value === undefined || chainIdRegex.test(value), {
    message: 'chainId must be a decimal chain identifier.',
  });

export const scanRequestSchema = z.object({
  tokenAddress: tokenAddressSchema,
  chainId: chainIdSchema,
  agentWallet: tokenAddressSchema.optional(),
});

export const authorizeRequestSchema = z.object({
  tokenAddress: tokenAddressSchema,
  chainId: chainIdSchema,
  agentWallet: tokenAddressSchema.optional(),
  action: z.string().trim().min(1).max(64).optional().default('transaction'),
  amountUsd: z.number().positive().optional(),
  recipient: tokenAddressSchema.optional(),
  spender: tokenAddressSchema.optional(),
  calldata: z.string().trim().regex(hexRegex, 'calldata must be 0x-prefixed hex.').optional(),
  executionHash: z.string().trim().regex(bytes32Regex, 'executionHash must be 32-byte 0x-prefixed hex.').optional(),
});

export const mcpScanInputSchema = {
  tokenAddress: tokenAddressSchema.describe('The token contract address to scan (0x-prefixed, 40 hex chars).'),
  chainId: chainIdSchema.describe('Optional EVM chain id override. If omitted, WatchTower auto-detects the chain.'),
  agentWallet: tokenAddressSchema.optional().describe('Your agent wallet address for reputation tracking.'),
};

export const mcpAuthorizeInputSchema = {
  tokenAddress: tokenAddressSchema.describe('The token contract address to authorize (0x-prefixed, 40 hex chars).'),
  chainId: chainIdSchema.describe('Optional EVM chain id override. If omitted, WatchTower auto-detects the chain.'),
  agentWallet: tokenAddressSchema.optional().describe('Your agent wallet address for reputation tracking.'),
  action: z.string().trim().min(1).max(64).optional().default('transaction').describe('The intended action (e.g. "swap", "transfer", "approve"). Defaults to "transaction".'),
  amountUsd: z.number().positive().optional().describe('Optional USD value of the intended transaction.'),
  recipient: tokenAddressSchema.optional().describe('Optional intended recipient address for this execution.'),
  spender: tokenAddressSchema.optional().describe('Optional spender address for approve/swap executions.'),
  calldata: z.string().trim().regex(hexRegex).optional().describe('Optional transaction calldata, 0x-prefixed hex. WatchTower signs its hash, not the raw calldata.'),
  executionHash: z.string().trim().regex(bytes32Regex).optional().describe('Optional caller-provided hash of the exact execution intent.'),
};

export type ScanRequestInput = z.infer<typeof scanRequestSchema>;
export type AuthorizeRequestInput = z.infer<typeof authorizeRequestSchema>;

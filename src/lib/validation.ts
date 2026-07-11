import { z } from 'zod';

const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const chainIdRegex = /^[0-9]+$/;

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

export const mcpScanInputSchema = {
  tokenAddress: tokenAddressSchema.describe('The token contract address to scan (0x-prefixed, 40 hex chars).'),
  chainId: chainIdSchema.describe('Optional EVM chain id override. If omitted, WatchTower auto-detects the chain.'),
  agentWallet: tokenAddressSchema.optional().describe('Your agent wallet address for reputation tracking.'),
};

export type ScanRequestInput = z.infer<typeof scanRequestSchema>;

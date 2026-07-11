/**
 * Structured Logger for WatchTower
 *
 * Outputs JSON-structured log lines compatible with Vercel Log Drain,
 * Datadog, and most log aggregation services.  Wraps console so existing
 * callsites can be migrated incrementally.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  service: 'watchtower';
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    service: 'watchtower',
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'debug':
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),

  /** Log a payment lifecycle event with standard fields. */
  payment(event: string, details: {
    paymentId?: string;
    tier?: string;
    amount?: string;
    currency?: string;
    network?: string;
    txHash?: string;
    payer?: string;
    [key: string]: unknown;
  }) {
    emit('info', `[Payment] ${event}`, { domain: 'payment', ...details });
  },

  /** Log on-chain registry submission results. */
  registry(event: string, details: {
    tokenAddress?: string;
    chainId?: string;
    txHash?: string | null;
    scanHash?: string;
    [key: string]: unknown;
  }) {
    emit('info', `[Registry] ${event}`, { domain: 'registry', ...details });
  },

  /** Log data provider interactions for observability. */
  provider(provider: string, event: string, details?: Record<string, unknown>) {
    emit('info', `[Provider:${provider}] ${event}`, { domain: 'provider', provider, ...details });
  },

  /** Log scan lifecycle events. */
  scan(event: string, details: {
    tokenAddress?: string;
    chainId?: string;
    tier?: string;
    threatScore?: number;
    recommendation?: string;
    activeModules?: number;
    unavailableModules?: number;
    [key: string]: unknown;
  }) {
    emit('info', `[Scan] ${event}`, { domain: 'scan', ...details });
  },
};

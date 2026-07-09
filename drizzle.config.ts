import type { Config } from 'drizzle-kit';

// ---------------------------------------------------------------------------
// Drizzle Kit Configuration — Environment-Aware
//
// Usage:
//   Local dev:  npx drizzle-kit push              (uses local watchtower.db)
//   Production: npx drizzle-kit push              (uses Turso if env vars set)
//
// Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local for production.
// ---------------------------------------------------------------------------

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

const config: Config = tursoUrl
  ? {
      // Production: Push schema to Turso
      schema: './src/lib/db/schema.ts',
      out: './drizzle',
      dialect: 'turso',
      dbCredentials: {
        url: tursoUrl,
        authToken: tursoToken,
      },
    }
  : {
      // Development: Push schema to local SQLite
      schema: './src/lib/db/schema.ts',
      out: './drizzle',
      dialect: 'sqlite',
      dbCredentials: {
        url: 'file:./watchtower.db',
      },
    };

export default config;

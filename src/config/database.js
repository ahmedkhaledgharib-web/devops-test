import './env.js';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
}

// Neon Local speaks the Neon serverless protocol over HTTP on port 5432.
// In production NEON_LOCAL is false and the driver talks to Neon Cloud.
if (process.env.NEON_LOCAL === 'true') {
    const { hostname, port } = new URL(databaseUrl);

    neonConfig.fetchEndpoint = process.env.NEON_LOCAL_FETCH_ENDPOINT
        ?? `http://${hostname}:${port || 5432}/sql`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.poolQueryViaFetch = true;
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema: 'public' });

export { sql, db };
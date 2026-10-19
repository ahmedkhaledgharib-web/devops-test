import { config } from 'dotenv';

const nodeEnv = process.env.NODE_ENV || 'development';

config({ path: `.env.${nodeEnv}`, quiet: true });
config({ path: `.env.${nodeEnv}.local`, override: true, quiet: true });
config({ quiet: true });

export default {
    schema: './src/models/*.js',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        // `sslmode=no-verify` in the local DATABASE_URL covers Neon Local's
        // self-signed certificate; production Neon URLs use `sslmode=require`.
        url: process.env.DATABASE_URL,
    },
}
// Loads and validates process env once at startup so a missing variable
// fails fast instead of surfacing as a cryptic error mid-request. The
// single .env lives at the repo root (shared with docker-compose), not
// inside server/, so its path is resolved relative to this file.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const required = [
  'DB_HOST', 'DB_PORT', 'DB_NAME_APP', 'DB_APP_USER', 'DB_APP_PASSWORD',
  'JWT_SECRET', 'PORT', 'CORS_ORIGIN'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  dbHost: process.env.DB_HOST,
  dbPort: Number(process.env.DB_PORT),
  dbName: process.env.DB_NAME_APP,
  dbUser: process.env.DB_APP_USER,
  dbPassword: process.env.DB_APP_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptCost: Number(process.env.BCRYPT_COST || 12),
  port: Number(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN,
  nodeEnv: process.env.NODE_ENV || 'development'
};

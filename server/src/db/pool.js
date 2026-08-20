// Single shared connection pool. The app connects as the restricted
// hd_app user (never root) — see db/06_roles.sql.
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

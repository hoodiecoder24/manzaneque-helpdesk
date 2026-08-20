import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Verifies the Bearer JWT and attaches { staffId, employeeId, username, role }
// to req.user. Generic message on failure — never reveals why (expired vs
// malformed vs missing) to avoid helping an attacker enumerate state.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized());
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      staffId: payload.staffId,
      employeeId: payload.employeeId,
      username: payload.username,
      role: payload.role
    };
    return next();
  } catch {
    return next(ApiError.unauthorized());
  }
}

import { ApiError } from '../utils/ApiError.js';

// requireAuth must run first so req.user is populated. Route-level RBAC
// mirrors the MySQL role grants in db/06_roles.sql (defence in depth —
// this is the layer actually enforced per-request; the DB roles are the
// backstop if this middleware is ever bypassed).
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  return next();
};

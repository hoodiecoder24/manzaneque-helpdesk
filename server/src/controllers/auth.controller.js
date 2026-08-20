import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findActiveStaffByUsername, findStaffById, verifyPassword } from '../services/auth.service.js';

// Deliberately generic on both "no such user" and "wrong password" —
// distinguishing them would let an attacker enumerate valid usernames.
export const login = asyncHandler(async (req, res, next) => {
  const { username, password } = req.body;
  const staff = await findActiveStaffByUsername(username);
  if (!staff) return next(ApiError.unauthorized('Invalid username or password'));

  const valid = await verifyPassword(password, staff.password_hash);
  if (!valid) return next(ApiError.unauthorized('Invalid username or password'));

  const token = jwt.sign(
    { staffId: staff.staff_id, employeeId: staff.employee_id, username: staff.username, role: staff.staff_role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  res.json({
    token,
    user: { staffId: staff.staff_id, username: staff.username, role: staff.staff_role, fullName: staff.full_name }
  });
});

export const me = asyncHandler(async (req, res, next) => {
  const staff = await findStaffById(req.user.staffId);
  if (!staff) return next(ApiError.unauthorized());
  res.json({ staffId: staff.staff_id, username: staff.username, role: staff.staff_role, fullName: staff.full_name });
});

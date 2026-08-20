import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

// Positive-integer route param (:id style). Used everywhere an FK is
// looked up from the URL so a non-numeric id 400s before it reaches SQL.
export const idParam = z.coerce.number().int().positive();

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

// Validates req.body against a Zod schema, replacing it with the parsed
// (coerced, defaulted) value. Field-level errors are surfaced under
// error.fields so the client form can highlight the offending input.
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors));
  }
  req.body = result.data;
  return next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors));
  }
  req.query = result.data;
  return next();
};

export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    return next(ApiError.badRequest('Invalid URL parameter'));
  }
  req.params = result.data;
  return next();
};

export const idParamsSchema = z.object({ id: idParam });

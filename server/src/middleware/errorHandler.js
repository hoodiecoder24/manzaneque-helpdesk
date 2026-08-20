import { ApiError } from '../utils/ApiError.js';

// Central error handler. Every route funnels here via next(err) or a
// thrown error inside an async wrapper (see asyncHandler.js).
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) }
    });
  }

  // MySQL FK/constraint violations surface as generic 409s rather than
  // leaking schema detail to the client.
  if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'This record is referenced elsewhere and cannot be changed.' }
    });
  }
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with these details already exists.' }
    });
  }

  console.error(err); // eslint-disable-line no-console
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' }
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}

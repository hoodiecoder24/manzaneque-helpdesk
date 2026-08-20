// Wraps an async route handler so a rejected promise reaches the central
// error handler instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

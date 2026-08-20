// Thrown anywhere in the request lifecycle; caught by the central error
// handler and rendered as { error: { code, message, fields? } }.
export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static badRequest(message, fields) {
    return new ApiError(400, 'BAD_REQUEST', message, fields);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Not permitted for this role') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message) {
    return new ApiError(409, 'CONFLICT', message);
  }
}

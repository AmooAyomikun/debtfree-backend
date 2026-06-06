import { NODE_ENV } from '../config/constants.js';
import { log } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  log.error(err.message, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
}

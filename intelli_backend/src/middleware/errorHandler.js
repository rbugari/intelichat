/**
 * Centralized error handling middleware
 */

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/**
 * Logger utility
 */
class Logger {
  static log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };
    
    // In production, you might want to use a proper logging library like Winston
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
    }
  }
  
  static info(message, meta = {}) {
    this.log('info', message, meta);
  }
  
  static warn(message, meta = {}) {
    this.log('warn', message, meta);
  }
  
  static error(message, meta = {}) {
    this.log('error', message, meta);
  }
  
  static debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, meta);
    }
  }
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  Logger.error('Error occurred', {
    error: error.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  // Handle specific error types
  if (err.code === 'ER_DUP_ENTRY') {
    error = new ConflictError('Duplicate entry detected');
  }
  
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = new ValidationError('Referenced resource does not exist');
  }
  
  if (err.code === 'ECONNREFUSED') {
    error = new DatabaseError('Database connection failed');
  }
  
  if (err.name === 'JsonWebTokenError') {
    error = new UnauthorizedError('Invalid token');
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new UnauthorizedError('Token expired');
  }
  
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
    error = new ValidationError('Validation failed', details);
  }
  
  // Default to 500 server error
  if (!error.isOperational) {
    error = new AppError('Internal server error', 500, 'INTERNAL_ERROR');
  }
  
  // Prepare response
  const response = {
    success: false,
    error: error.message,
    code: error.code
  };
  
  // Add details for validation errors
  if (error.details) {
    response.details = error.details;
  }
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(error.statusCode || 500).json(response);
}

/**
 * 404 handler middleware
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log request
  Logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    Logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id
    });
  });
  
  next();
}

/**
 * Rate limiting helper
 */
function createRateLimit(windowMs = 15 * 60 * 1000, max = 100) {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [ip, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(time => time > windowStart);
      if (validTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, validTimestamps);
      }
    }
    
    // Check current IP
    const userRequests = requests.get(key) || [];
    const validRequests = userRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current request
    validRequests.push(now);
    requests.set(key, validRequests);
    
    next();
  };
}

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  DatabaseError,
  
  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestLogger,
  createRateLimit,
  
  // Logger
  Logger
};
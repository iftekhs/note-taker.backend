import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { message: err.message, ...(err.details !== undefined && { details: err.details }) },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: Object.values(err.errors).map((issue) => issue.message),
      },
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { message: `Invalid ${err.path}` } });
  }

  const mongoError = err as { code?: number; keyValue?: Record<string, unknown> };
  if (mongoError.code === 11000) {
    const field = Object.keys(mongoError.keyValue ?? {})[0] ?? 'value';
    return res.status(409).json({ error: { message: `${field} already exists` } });
  }

  const httpError = err as { status?: number; statusCode?: number; type?: string; message?: string };
  const status = httpError.status ?? httpError.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({
      error: {
        message:
          httpError.type === 'entity.parse.failed'
            ? 'Invalid JSON body'
            : httpError.message || 'Bad request',
      },
    });
  }

  if (err instanceof Error) {
    console.error(err);
  }

  return res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(env.NODE_ENV !== 'production' && err instanceof Error && { details: err.message }),
    },
  });
};

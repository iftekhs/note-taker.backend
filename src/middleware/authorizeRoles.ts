import type { RequestHandler } from 'express';
import type { Role } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

/** Route guard for admin-only endpoints. Use after authenticate. */
export function authorizeRoles(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, 'Forbidden'));
    next();
  };
}

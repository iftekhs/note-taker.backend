import type { Request, RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, type UserDocument } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

/** Reads the Authorization: Bearer token and loads the current user from MongoDB. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new ApiError(401, 'Authentication required');

    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    if (!payload.sub) throw new ApiError(401, 'Invalid token');

    // Reloading the user makes role changes and deletions take effect immediately.
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'User no longer exists');

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error instanceof Error && ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      return next(new ApiError(401, error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
    next(error);
  }
};

/** Narrowed accessor for controllers mounted behind authenticate. */
export function authUser(req: Request): UserDocument {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

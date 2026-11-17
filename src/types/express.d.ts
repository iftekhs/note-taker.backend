import type { UserDocument } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware after loading the user. */
      user?: UserDocument;
      /** Parsed by the validate middleware. Express 5 keeps req.query read-only. */
      validated: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};

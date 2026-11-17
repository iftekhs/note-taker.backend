import type { RequestHandler } from 'express';
import { authUser } from '../middleware/authenticate.js';

/** GET /api/me */
export const getMe: RequestHandler = (req, res) => {
  res.json({ data: authUser(req).toJSON() });
};

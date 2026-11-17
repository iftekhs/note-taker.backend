import type { RequestHandler } from 'express';
import { authUser } from '../middleware/authenticate.js';

export const getMe: RequestHandler = (req, res) => {
  res.json({ data: authUser(req).toJSON() });
};

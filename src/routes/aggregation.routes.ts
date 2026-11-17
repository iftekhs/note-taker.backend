import { Router } from 'express';
import {
  groupedByInterests,
  postsByUser,
} from '../controllers/aggregation.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { validate } from '../middleware/validate.js';
import { groupedByInterestsQuerySchema } from '../validators/aggregation.validators.js';
import { idParamSchema, paginationQuerySchema } from '../validators/common.validators.js';

/**
 * Mounted at /api/users BEFORE the admin CRUD router, so that
 * /grouped-by-interests is not swallowed by /:id.
 */
export const aggregationRouter = Router();

aggregationRouter.get(
  '/grouped-by-interests',
  authenticate,
  authorizeRoles('admin'),
  validate({ query: groupedByInterestsQuerySchema }),
  groupedByInterests,
);

aggregationRouter.get(
  '/:id/posts',
  authenticate,
  validate({ params: idParamSchema, query: paginationQuerySchema }),
  postsByUser,
);

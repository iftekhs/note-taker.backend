import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validators.js';
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from '../validators/user.validators.js';

export const userRouter = Router();

userRouter.use(authenticate, authorizeRoles('admin'));

userRouter.post('/', validate({ body: createUserSchema }), createUser);
userRouter.get('/', validate({ query: userListQuerySchema }), listUsers);
userRouter.get('/:id', validate({ params: idParamSchema }), getUser);
userRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: updateUserSchema }),
  updateUser,
);
userRouter.delete('/:id', validate({ params: idParamSchema }), deleteUser);

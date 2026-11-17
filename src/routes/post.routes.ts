import { Router } from 'express';
import { createPost, listPosts } from '../controllers/post.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createPostSchema, postListQuerySchema } from '../validators/post.validators.js';

export const postRouter = Router();

postRouter.use(authenticate);

postRouter.post('/', validate({ body: createPostSchema }), createPost);
postRouter.get('/', validate({ query: postListQuerySchema }), listPosts);

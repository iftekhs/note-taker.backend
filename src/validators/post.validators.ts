import { z } from 'zod';
import { paginationQuerySchema } from './common.validators.js';

export const createPostSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(50000),
  })
  .strict();

export const postListQuerySchema = paginationQuerySchema;

export type CreatePostInput = z.infer<typeof createPostSchema>;

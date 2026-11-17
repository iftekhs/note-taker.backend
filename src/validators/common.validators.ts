import { Types } from 'mongoose';
import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .refine(
    (value) => /^[a-f\d]{24}$/i.test(value) && Types.ObjectId.isValid(value),
    'Invalid ObjectId',
  );

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const idParamSchema = z.object({ id: objectIdSchema });

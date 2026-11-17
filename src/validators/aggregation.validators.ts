import { z } from 'zod';
import { paginationQuerySchema } from './common.validators.js';

export const groupedByInterestsQuerySchema = paginationQuerySchema.extend({
  interest: z.string().trim().min(1).max(50).optional(),
});

export type GroupedByInterestsQuery = z.infer<typeof groupedByInterestsQuerySchema>;

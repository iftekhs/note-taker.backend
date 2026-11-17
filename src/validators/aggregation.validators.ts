import { z } from 'zod';
import { paginationQuerySchema } from './common.validators.js';

export const groupedByInterestsQuerySchema = paginationQuerySchema.extend({
  // Required so the pipeline always starts with an indexed $match on interests.
  interest: z.string().trim().min(1).max(50),
});

export type GroupedByInterestsQuery = z.infer<typeof groupedByInterestsQuerySchema>;

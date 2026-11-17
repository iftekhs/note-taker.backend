import { z } from 'zod';
import { paginationQuerySchema } from './common.validators.js';

const titleSchema = z.string().trim().min(1).max(200);
const contentSchema = z.string().trim().min(1).max(50000);

export const createNoteSchema = z
  .object({
    title: titleSchema,
    content: contentSchema,
  })
  .strict();

export const updateNoteSchema = z
  .object({
    title: titleSchema.optional(),
    content: contentSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const noteListQuerySchema = paginationQuerySchema.extend({
  owner: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid owner id').optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;

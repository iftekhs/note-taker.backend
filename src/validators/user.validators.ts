import { z } from 'zod';
import { emailSchema, interestsSchema, optionalInterestsSchema, passwordSchema } from './auth.validators.js';
import { paginationQuerySchema } from './common.validators.js';

const nameSchema = z.string().trim().min(1).max(100);
const roleSchema = z.enum(['user', 'admin']);

export const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema.optional(),
    interests: interestsSchema.optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: roleSchema.optional(),
    interests: optionalInterestsSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const userListQuerySchema = paginationQuerySchema;

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

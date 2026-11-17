import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters');

const nameSchema = z.string().trim().min(1).max(100);

const interestsShape = z
  .array(z.string().trim().min(1).max(50))
  .max(20)
  .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]);

export const interestsSchema = interestsShape.default([]);
export const optionalInterestsSchema = interestsShape.optional();

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    interests: interestsSchema.optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(72),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

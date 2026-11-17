import bcrypt from 'bcrypt';
import type { RequestHandler } from 'express';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { paginated, paginationParams } from '../utils/pagination.js';
import type { CreateUserInput, UpdateUserInput } from '../validators/user.validators.js';
import type { PaginationInput } from '../utils/pagination.js';

const SALT_ROUNDS = 12;

/** POST /api/users (admin) */
export const createUser: RequestHandler = async (req, res) => {
  const { name, email, password, role, interests } = req.validated.body as CreateUserInput;

  const exists = await User.exists({ email });
  if (exists) throw new ApiError(409, 'email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: role ?? 'user',
    interests: interests ?? [],
  });

  res.status(201).json({ data: user });
};

/** GET /api/users (admin) */
export const listUsers: RequestHandler = async (req, res) => {
  const { page, limit } = req.validated.query as PaginationInput;
  const { skip } = paginationParams({ page, limit });

  const [users, total] = await Promise.all([
    User.find().select('-__v').sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);

  res.json(paginated(users, page, limit, total));
};

/** GET /api/users/:id (admin) */
export const getUser: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as { id: string };
  const user = await User.findById(id).select('-__v');
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ data: user });
};

/** PUT /api/users/:id (admin) — role changes are allowed here only. */
export const updateUser: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as { id: string };
  const { name, email, password, role, interests } = req.validated.body as UpdateUserInput;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (interests !== undefined) updates.interests = interests;
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).select('-__v');

  if (!user) throw new ApiError(404, 'User not found');
  res.json({ data: user });
};

/** DELETE /api/users/:id (admin) */
export const deleteUser: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as { id: string };
  const user = await User.findByIdAndDelete(id);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(204).send();
};

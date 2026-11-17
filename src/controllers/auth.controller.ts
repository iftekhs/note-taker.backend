import bcrypt from 'bcrypt';
import type { RequestHandler } from 'express';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/token.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validators.js';

const SALT_ROUNDS = 12;

export const register: RequestHandler = async (req, res) => {
  const { name, email, password, interests } = req.validated.body as RegisterInput;

  const exists = await User.exists({ email });
  if (exists) throw new ApiError(409, 'email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'user',
    interests: interests ?? [],
  });

  res.status(201).json({ token: signToken(user), user: user.toJSON() });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.validated.body as LoginInput;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) throw new ApiError(401, 'Invalid email or password');

  res.json({ token: signToken(user), user: user.toJSON() });
};

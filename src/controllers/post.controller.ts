import type { RequestHandler } from 'express';
import { authUser } from '../middleware/authenticate.js';
import { Post } from '../models/Post.js';
import { paginated, paginationParams, type PaginationInput } from '../utils/pagination.js';
import type { CreatePostInput } from '../validators/post.validators.js';

export const createPost: RequestHandler = async (req, res) => {
  const user = authUser(req);
  const { title, content } = req.validated.body as CreatePostInput;

  const post = await Post.create({ author: user._id, title, content });
  res.status(201).json({ data: post });
};

export const listPosts: RequestHandler = async (req, res) => {
  const { page, limit } = req.validated.query as PaginationInput;
  const { skip } = paginationParams({ page, limit });

  const [posts, total] = await Promise.all([
    Post.find().select('-__v').sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(),
  ]);

  res.json(paginated(posts, page, limit, total));
};

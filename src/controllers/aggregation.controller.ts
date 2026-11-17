import type { RequestHandler } from 'express';
import { Types, type PipelineStage } from 'mongoose';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { paginated, paginationParams, type PaginationInput } from '../utils/pagination.js';
import type { GroupedByInterestsQuery } from '../validators/aggregation.validators.js';

export const groupedByInterests: RequestHandler = async (req, res) => {
  const { page, limit, interest } = req.validated.query as GroupedByInterestsQuery;
  const { skip } = paginationParams({ page, limit });
  const normalizedInterest = interest.toLowerCase();

  const pipeline: PipelineStage[] = [
    { $match: { interests: normalizedInterest } },
    { $unwind: '$interests' },
    { $match: { interests: normalizedInterest } },
    {
      $group: {
        _id: '$interests',
        users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
        count: { $sum: 1 },
      },
    },
    {
      $facet: {
        data: [{ $sort: { count: -1, _id: 1 } }, { $skip: skip }, { $limit: limit }],
        meta: [{ $count: 'total' }],
      },
    },
    {
      $project: {
        _id: 0,
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
      },
    },
  ];

  const [result] = await User.aggregate<{ data: unknown[]; total: number }>(pipeline);

  res.json(paginated(result?.data ?? [], page, limit, result?.total ?? 0));
};

export const postsByUser: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as { id: string };
  const { page, limit } = req.validated.query as PaginationInput;
  const { skip } = paginationParams({ page, limit });

  const pipeline: PipelineStage[] = [
    { $match: { _id: new Types.ObjectId(id) } },
    {
      $lookup: {
        from: 'posts',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$author', '$$userId'] } } },
          { $sort: { _id: -1 } },
          {
            $facet: {
              data: [{ $skip: skip }, { $limit: limit }],
              meta: [{ $count: 'total' }],
            },
          },
          {
            $project: {
              _id: 0,
              posts: '$data',
              total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
            },
          },
        ],
        as: 'postResult',
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        interests: 1,
        posts: { $ifNull: [{ $arrayElemAt: ['$postResult.posts', 0] }, []] },
        total: { $ifNull: [{ $arrayElemAt: ['$postResult.total', 0] }, 0] },
      },
    },
  ];

  const [result] = await User.aggregate<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    interests: string[];
    posts: Array<Record<string, unknown> & { __v?: number }>;
    total: number;
  }>(pipeline);

  if (!result) throw new ApiError(404, 'User not found');

  const posts = result.posts.map(({ __v: _version, ...post }) => post);

  res.json({
    ...paginated(posts, page, limit, result.total),
    user: {
      _id: result._id,
      name: result.name,
      email: result.email,
      interests: result.interests,
    },
  });
};

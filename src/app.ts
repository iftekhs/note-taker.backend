import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { aggregationRouter } from './routes/aggregation.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { meRouter } from './routes/me.routes.js';
import { noteRouter } from './routes/note.routes.js';
import { postRouter } from './routes/post.routes.js';
import { userRouter } from './routes/user.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/notes', noteRouter);
  app.use('/api/posts', postRouter);
  app.use('/api/users', aggregationRouter);
  app.use('/api/users', userRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

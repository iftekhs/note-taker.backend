import type { Express } from 'express';
import type { Server } from 'node:http';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';

/**
 * Connects to MongoDB, syncs local indexes, starts listening, and wires up
 * graceful shutdown. Kept out of the Express app definition so `server.ts`
 * only describes routes and middleware.
 */
export async function startServer(app: Express): Promise<Server> {
  await connectDB(env.MONGO_URI);

  if (env.NODE_ENV !== 'production') {
    // Keep local indexes exactly in sync with the model declarations.
    await Promise.all([User.syncIndexes(), Note.syncIndexes(), Post.syncIndexes()]);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

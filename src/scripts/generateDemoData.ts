import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';

// Hard cap of 100 documents per model. The seeded admin accounts for one user,
// so the demo seeder creates 99 to keep the users collection at exactly 100.
const MAX_SEED = 100;
const USER_COUNT = MAX_SEED - 1;
const NOTE_COUNT = MAX_SEED;
const POST_COUNT = MAX_SEED;
const INTERESTS = ['tech', 'music', 'travel', 'sports', 'reading', 'cooking'];

/**
 * Generates realistic volume for planner/explain checks. Only removes the
 * demo accounts it created itself (demoN@example.com) and their content.
 */
async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to generate demo data in production');
  }

  await connectDB(env.MONGO_URI);

  const oldUsers = await User.find({ email: /^demo\d+@example\.com$/ }).select('_id').lean();
  if (oldUsers.length > 0) {
    const ids = oldUsers.map((user) => user._id);
    await Promise.all([
      Note.deleteMany({ owner: { $in: ids } }),
      Post.deleteMany({ author: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids } }),
    ]);
    console.log(`Removed ${oldUsers.length} old demo users and their content`);
  }

  console.log('Hashing demo password once...');
  const passwordHash = await bcrypt.hash('Password123', 12);

  const users = Array.from({ length: USER_COUNT }, (_, index) => {
    const count = (index % 3) + 1;
    const interests = Array.from(
      { length: count },
      (_, offset) => INTERESTS[(index + offset * 2) % INTERESTS.length],
    );
    return {
      name: `Demo User ${index + 1}`,
      email: `demo${index + 1}@example.com`,
      passwordHash,
      role: 'user' as const,
      interests: [...new Set(interests)],
    };
  });

  const inserted = await User.insertMany(users, { ordered: false });
  const userIds = inserted.map((user) => user._id);
  console.log(`Inserted ${userIds.length} users`);

  const notes = Array.from({ length: NOTE_COUNT }, (_, index) => ({
    owner: userIds[index % userIds.length],
    title: `Demo note ${index + 1}`,
    content: `Content for demo note ${index + 1}. Seeded for index verification.`,
  }));

  for (let offset = 0; offset < notes.length; offset += 1000) {
    await Note.insertMany(notes.slice(offset, offset + 1000), { ordered: false });
  }
  console.log(`Inserted ${notes.length} notes`);

  const posts = Array.from({ length: POST_COUNT }, (_, index) => ({
    author: userIds[index % userIds.length],
    title: `Demo post ${index + 1}`,
    content: `Content for demo post ${index + 1}. Seeded for aggregation verification.`,
  }));

  for (let offset = 0; offset < posts.length; offset += 1000) {
    await Post.insertMany(posts.slice(offset, offset + 1000), { ordered: false });
  }
  console.log(`Inserted ${posts.length} posts`);

  console.log('Demo login: demo1@example.com / Password123');
}

main()
  .catch((error) => {
    console.error('Demo data seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });

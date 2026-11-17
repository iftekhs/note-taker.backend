import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

/** Creates the first admin. Safe to re-run: an existing account is promoted, not reset. */
async function main(): Promise<void> {
  await connectDB(env.MONGO_URI);

  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted existing user to admin: ${email}`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await User.create({
    name: env.ADMIN_NAME,
    email,
    passwordHash,
    role: 'admin',
    interests: [],
  });

  console.log(`Admin created: ${email}`);
  console.log('Use the ADMIN_EMAIL / ADMIN_PASSWORD values from .env to log in.');
}

main()
  .catch((error) => {
    console.error('Admin seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });

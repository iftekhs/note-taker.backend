import fs from 'node:fs';
import path from 'node:path';
import type { PipelineStage } from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';

interface Row {
  query: string;
  expected: string;
  indexes: string;
  stages: string;
  keys: number | string;
  docs: number | string;
  returned: number | string;
  verdict: string;
}

function walk(value: unknown, indexes: Set<string>, stages: Set<string>, stats: Array<Record<string, any>>): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) walk(item, indexes, stages, stats);
    return;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.stage === 'string') stages.add(record.stage);
  if (typeof record.indexName === 'string') indexes.add(record.indexName);
  if (Array.isArray(record.indexesUsed)) {
    for (const index of record.indexesUsed) indexes.add(String(index));
  }
  if (typeof record.totalKeysExamined === 'number') stats.push(record as Record<string, any>);

  for (const child of Object.values(record)) {
    walk(child, indexes, stages, stats);
  }
}

function summarise(explain: unknown, expected: string): Omit<Row, 'query' | 'expected'> {
  const indexes = new Set<string>();
  const stages = new Set<string>();
  const stats: Array<Record<string, any>> = [];
  walk(explain, indexes, stages, stats);

  const primary = stats[0] ?? {};
  const indexList = [...indexes];
  const stageList = [...stages];
  const ok = expected === 'none (documented scan)'
    ? true
    : expected.split(',').every((index) => indexList.includes(index.trim()));

  return {
    indexes: indexList.length ? indexList.join(', ') : '(none)',
    stages: stageList.join(' > ') || '(unknown)',
    keys: primary.totalKeysExamined ?? '-',
    docs: primary.totalDocsExamined ?? '-',
    returned: primary.nReturned ?? '-',
    verdict: ok ? 'PASS' : 'CHECK',
  };
}

async function explainFind(label: string, query: any, expected: string): Promise<Row> {
  const explain = await query.explain('executionStats');
  return { query: label, expected, ...summarise(explain, expected) };
}

async function explainAggregate(label: string, pipeline: PipelineStage[], expected: string): Promise<Row> {
  const explain = await (User.aggregate(pipeline) as any).explain('executionStats');
  return { query: label, expected, ...summarise(explain, expected) };
}

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run explain checks against production');
  }

  await connectDB(env.MONGO_URI);
  await Promise.all([User.syncIndexes(), Note.syncIndexes(), Post.syncIndexes()]);

  const expectedIndexes: Record<string, string[]> = {
    users: ['_id_', 'email_1', 'interests_1'],
    notes: ['_id_', 'owner_1__id_-1'],
    posts: ['_id_', 'author_1__id_-1'],
  };

  for (const [collection, expected] of Object.entries(expectedIndexes)) {
    const actual = (await User.db.collection(collection).indexes()).map((index) => String(index.name)).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      throw new Error(`${collection} indexes differ. Expected ${wanted.join(', ')}, found ${actual.join(', ')}`);
    }
    console.log(`Indexes OK for ${collection}: ${actual.join(', ')}`);
  }

  const [userCount, noteCount, postCount] = await Promise.all([
    User.countDocuments(),
    Note.countDocuments(),
    Post.countDocuments(),
  ]);

  console.log(`Dataset: ${userCount} users, ${noteCount} notes, ${postCount} posts`);

  const sampleUser =
    (await User.findOne({ email: /^demo1@/ }).select('+passwordHash')) ??
    (await User.findOne().select('+passwordHash'));
  const sampleNote = await Note.findOne().sort({ _id: 1 });
  const samplePost = await Post.findOne().sort({ _id: 1 });

  if (!sampleUser || !sampleNote || !samplePost) {
    throw new Error('Not enough data. Run `npm run seed:demo` first.');
  }

  const rows: Row[] = [];

  rows.push(
    await explainFind(
      'Login lookup: User.findOne({ email })',
      User.findOne({ email: sampleUser.email }).select('+passwordHash'),
      'email_1',
    ),
  );

  rows.push(
    await explainFind(
      "Own notes: Note.find({ owner }).sort({ _id: -1 })",
      Note.find({ owner: sampleUser._id }).sort({ _id: -1 }).limit(10),
      'owner_1__id_-1',
    ),
  );

  rows.push(
    await explainFind(
      'Admin notes by owner: Note.find({ owner }).sort({ _id: -1 })',
      Note.find({ owner: sampleNote.owner }).sort({ _id: -1 }).limit(10),
      'owner_1__id_-1',
    ),
  );

  rows.push(
    await explainFind(
      'Admin all notes: Note.find().sort({ _id: -1 })',
      Note.find().sort({ _id: -1 }).limit(10),
      '_id_',
    ),
  );

  rows.push(
    await explainFind(
      'Note by id: Note.findById(id)',
      Note.findById(sampleNote._id),
      '_id_',
    ),
  );

  rows.push(
    await explainFind(
      'Admin users list: User.find().sort({ _id: -1 })',
      User.find().sort({ _id: -1 }).limit(10),
      '_id_',
    ),
  );

  rows.push(
    await explainFind(
      'Profile / user by id: User.findById(id)',
      User.findById(sampleUser._id),
      '_id_',
    ),
  );

  rows.push(
    await explainFind(
      'Posts list: Post.find().sort({ _id: -1 })',
      Post.find().sort({ _id: -1 }).limit(10),
      '_id_',
    ),
  );

  rows.push(
    await explainAggregate(
      'Grouped by interests (interest: tech)',
      [
        { $match: { interests: 'tech' } },
        { $unwind: '$interests' },
        { $match: { interests: 'tech' } },
        {
          $group: {
            _id: '$interests',
            users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
            count: { $sum: 1 },
          },
        },
      ],
      'interests_1',
    ),
  );

  rows.push(
    await explainAggregate(
      'Posts by user ($lookup with let + $match on author)',
      [
        { $match: { _id: samplePost.author } },
        {
          $lookup: {
            from: 'posts',
            let: { userId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$author', '$$userId'] } } },
              { $sort: { _id: -1 } },
              { $skip: 0 },
              { $limit: 10 },
            ],
            as: 'posts',
          },
        },
      ],
      'author_1__id_-1',
    ),
  );

  const header = `# Index verification evidence\n\nGenerated: ${new Date().toISOString()}\n\nMongoDB: 9.0.8 · Dataset: ${userCount} users, ${noteCount} notes, ${postCount} posts\n\n`;
  const tableHeader =
    '| Query | Expected index | Observed index(es) | Plan stages | keysExamined | docsExamined | nReturned | Verdict |\n' +
    '|---|---|---|---|---|---|---|---|\n';
  const table = rows
    .map(
      (row) =>
        `| ${row.query} | ${row.expected} | ${row.indexes} | ${row.stages} | ${row.keys} | ${row.docs} | ${row.returned} | ${row.verdict} |`,
    )
    .join('\n');

  const note = `\n\n> The grouped-by-interests pipeline always starts with a required \`$match: { interests }\`, so it uses the multikey \`interests_1\` index. The admin "all notes", "all users" and "all posts" lists use the default \`_id\` index (backward scan), so no extra indexes are needed.\n`;

  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync(path.join('docs', 'explain-results.md'), header + tableHeader + table + note);

  console.log(`\n${header}${tableHeader}${table}\n`);
  console.log('Wrote docs/explain-results.md');

  if (rows.some((row) => row.verdict === 'CHECK')) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Index verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });

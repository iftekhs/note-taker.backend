import type { Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';
import { User } from '../src/models/User.js';

const app: Express = createApp();
const bearer = (token: string) => `Bearer ${token}`;

interface Session {
  id: string;
  token: string;
  user: Record<string, unknown>;
}

async function registerUser(
  name: string,
  email: string,
  interests: string[] = [],
): Promise<Session> {
  const response = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123',
    interests,
  });
  expect(response.status).toBe(201);
  return {
    id: response.body.user._id,
    token: response.body.token,
    user: response.body.user,
  };
}

async function createUserDirect(email: string, role: 'user' | 'admin' = 'user') {
  const user = await User.create({
    name: email.split('@')[0],
    email,
    passwordHash: 'not-a-real-hash',
    role,
  });
  return user;
}

async function promote(userId: string) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('health and authentication', () => {
  it('reports API health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('registers with normalised fields, a bcrypt cost-12 hash, and no leaked hash', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: '  Ada Lovelace  ',
      email: ' ADA@Example.COM ',
      password: 'Password123',
      interests: [' Tech ', 'tech', 'Music'],
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'user',
      interests: ['tech', 'music'],
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.token).toEqual(expect.any(String));

    const stored = await User.findById(response.body.user._id).select('+passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('rejects duplicate emails with 409', async () => {
    await registerUser('First', 'duplicate@example.com');
    const response = await request(app).post('/api/auth/register').send({
      name: 'Second',
      email: 'duplicate@example.com',
      password: 'Password123',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/already exists/i);
  });

  it('validates registration bodies and rejects unknown fields', async () => {
    const short = await request(app).post('/api/auth/register').send({
      name: 'Short',
      email: 'short@example.com',
      password: 'tiny',
    });
    expect(short.status).toBe(400);
    expect(short.body.error.message).toBe('Validation failed');

    const extra = await request(app).post('/api/auth/register').send({
      name: 'Extra',
      email: 'extra@example.com',
      password: 'Password123',
      role: 'admin',
    });
    expect(extra.status).toBe(400);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    await registerUser('Login User', 'login@example.com');
    const good = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password123' });
    expect(good.status).toBe(200);
    expect(good.body.token).toEqual(expect.any(String));

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe('Invalid email or password');
  });

  it('guards /api/me with a valid bearer token', async () => {
    const session = await registerUser('Me User', 'me@example.com');
    const ok = await request(app).get('/api/me').set('Authorization', bearer(session.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ email: 'me@example.com', role: 'user' });

    const missing = await request(app).get('/api/me');
    expect(missing.status).toBe(401);

    const invalid = await request(app).get('/api/me').set('Authorization', 'Bearer not.a.token');
    expect(invalid.status).toBe(401);
  });

  it('returns a consistent 404 for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.message).toMatch(/Route not found/);
  });
});

describe('users and RBAC', () => {
  it('blocks non-admins from every user-management route', async () => {
    const user = await registerUser('Plain User', 'plain@example.com');
    const id = new User()._id.toString();

    expect((await request(app).get('/api/users').set('Authorization', bearer(user.token))).status).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/users')
          .set('Authorization', bearer(user.token))
          .send({ name: 'X', email: 'x@example.com', password: 'Password123' })
      ).status,
    ).toBe(403);
    expect((await request(app).get(`/api/users/${id}`).set('Authorization', bearer(user.token))).status).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/users/${id}`)
          .set('Authorization', bearer(user.token))
          .send({ name: 'X' })
      ).status,
    ).toBe(403);
    expect((await request(app).delete(`/api/users/${id}`).set('Authorization', bearer(user.token))).status).toBe(403);
  });

  it('supports the full admin user CRUD lifecycle', async () => {
    const admin = await registerUser('Admin', 'admin-user@example.com');
    await promote(admin.id);

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(admin.token))
      .send({
        name: 'Managed User',
        email: 'managed@example.com',
        password: 'Password123',
        role: 'admin',
        interests: ['Tech', 'music'],
      });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Managed User',
      email: 'managed@example.com',
      role: 'admin',
      interests: ['tech', 'music'],
    });
    expect(created.body.data.passwordHash).toBeUndefined();

    const id = created.body.data._id;
    const fetched = await request(app)
      .get(`/api/users/${id}`)
      .set('Authorization', bearer(admin.token));
    expect(fetched.status).toBe(200);

    const updated = await request(app)
      .put(`/api/users/${id}`)
      .set('Authorization', bearer(admin.token))
      .send({ name: 'Renamed', role: 'user', interests: ['travel'], password: 'NewPassword123' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: 'Renamed',
      role: 'user',
      interests: ['travel'],
    });

    const deleted = await request(app)
      .delete(`/api/users/${id}`)
      .set('Authorization', bearer(admin.token));
    expect(deleted.status).toBe(204);

    const gone = await request(app)
      .get(`/api/users/${id}`)
      .set('Authorization', bearer(admin.token));
    expect(gone.status).toBe(404);
  });

  it('deletes notes and posts belonging to a deleted user, leaving others intact', async () => {
    const admin = await registerUser('Cascade Admin', 'cascade-admin@example.com');
    await promote(admin.id);

    const doomed = await registerUser('Doomed User', 'doomed@example.com');
    const survivor = await registerUser('Surviving User', 'survivor@example.com');

    await Note.create([
      { owner: doomed.id, title: 'Doomed note 1', content: 'one' },
      { owner: doomed.id, title: 'Doomed note 2', content: 'two' },
      { owner: survivor.id, title: 'Survivor note', content: 'three' },
    ]);
    await Post.create([
      { author: doomed.id, title: 'Doomed post', content: 'one' },
      { author: survivor.id, title: 'Survivor post', content: 'two' },
    ]);

    const response = await request(app)
      .delete(`/api/users/${doomed.id}`)
      .set('Authorization', bearer(admin.token));
    expect(response.status).toBe(204);

    expect(await User.exists({ _id: doomed.id })).toBeNull();
    expect(await User.exists({ _id: survivor.id })).not.toBeNull();

    expect(await Note.countDocuments({ owner: doomed.id })).toBe(0);
    expect(await Post.countDocuments({ author: doomed.id })).toBe(0);
    expect(await Note.countDocuments({ owner: survivor.id })).toBe(1);
    expect(await Post.countDocuments({ author: survivor.id })).toBe(1);
  });

  it('paginates the admin user list', async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) => createUserDirect(`page${index}@example.com`)),
    );
    const admin = await registerUser('Paging Admin', 'paging-admin@example.com');
    await promote(admin.id);

    const first = await request(app)
      .get('/api/users?page=1&limit=10')
      .set('Authorization', bearer(admin.token));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ page: 1, limit: 10, total: 13, totalPages: 2 });
    expect(first.body.data).toHaveLength(10);

    const second = await request(app)
      .get('/api/users?page=2&limit=10')
      .set('Authorization', bearer(admin.token));
    expect(second.body.data).toHaveLength(3);
  });

  it('applies role changes immediately to the existing token', async () => {
    const session = await registerUser('Role Changer', 'role-changer@example.com');
    expect((await request(app).get('/api/users').set('Authorization', bearer(session.token))).status).toBe(403);

    await promote(session.id);
    expect((await request(app).get('/api/users').set('Authorization', bearer(session.token))).status).toBe(200);

    await User.findByIdAndUpdate(session.id, { role: 'user' });
    expect((await request(app).get('/api/users').set('Authorization', bearer(session.token))).status).toBe(403);
  });

  it('validates user ids and updates', async () => {
    const admin = await registerUser('Validation Admin', 'validation-admin@example.com');
    await promote(admin.id);

    const badId = await request(app)
      .get('/api/users/not-an-id')
      .set('Authorization', bearer(admin.token));
    expect(badId.status).toBe(400);

    const empty = await request(app)
      .put(`/api/users/${admin.id}`)
      .set('Authorization', bearer(admin.token))
      .send({});
    expect(empty.status).toBe(400);

    const unknown = await request(app)
      .put(`/api/users/${admin.id}`)
      .set('Authorization', bearer(admin.token))
      .send({ nickname: 'nope' });
    expect(unknown.status).toBe(400);
  });
});

describe('notes', () => {
  it('creates, lists, reads, updates and deletes an owned note', async () => {
    const owner = await registerUser('Note Owner', 'note-owner@example.com');
    const created = await request(app)
      .post('/api/notes')
      .set('Authorization', bearer(owner.token))
      .send({ title: 'My note', content: 'Private content' });
    expect(created.status).toBe(201);
    const id = created.body.data._id;

    const list = await request(app).get('/api/notes').set('Authorization', bearer(owner.token));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ title: 'My note', owner: owner.id });

    const read = await request(app).get(`/api/notes/${id}`).set('Authorization', bearer(owner.token));
    expect(read.status).toBe(200);

    const updated = await request(app)
      .put(`/api/notes/${id}`)
      .set('Authorization', bearer(owner.token))
      .send({ title: 'Updated note' });
    expect(updated.body.data.title).toBe('Updated note');

    const deleted = await request(app)
      .delete(`/api/notes/${id}`)
      .set('Authorization', bearer(owner.token));
    expect(deleted.status).toBe(204);
    expect(await Note.countDocuments()).toBe(0);
  });

  it('keeps writes owner-only, including for admins', async () => {
    const owner = await registerUser('Owner', 'owner@example.com');
    const other = await registerUser('Other', 'other@example.com');
    const admin = await registerUser('Note Admin', 'note-admin@example.com');
    await promote(admin.id);

    const note = await Note.create({ owner: owner.id, title: 'Owned', content: 'Secret' });
    const id = note._id.toString();

    expect((await request(app).get(`/api/notes/${id}`).set('Authorization', bearer(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/notes/${id}`).set('Authorization', bearer(admin.token))).status).toBe(200);

    for (const session of [other, admin]) {
      expect(
        (
          await request(app)
            .put(`/api/notes/${id}`)
            .set('Authorization', bearer(session.token))
            .send({ title: 'Hacked' })
        ).status,
      ).toBe(403);
      expect(
        (await request(app).delete(`/api/notes/${id}`).set('Authorization', bearer(session.token))).status,
      ).toBe(403);
    }
  });

  it('lets admins read all notes and filter by owner, while ignoring filters for users', async () => {
    const ownerA = await registerUser('Owner A', 'owner-a@example.com');
    const ownerB = await registerUser('Owner B', 'owner-b@example.com');
    const admin = await registerUser('Reader Admin', 'reader-admin@example.com');
    await promote(admin.id);

    await Note.create([
      { owner: ownerA.id, title: 'A1', content: 'a1' },
      { owner: ownerA.id, title: 'A2', content: 'a2' },
      { owner: ownerB.id, title: 'B1', content: 'b1' },
    ]);

    const all = await request(app).get('/api/notes').set('Authorization', bearer(admin.token));
    expect(all.body.total).toBe(3);

    const filtered = await request(app)
      .get(`/api/notes?owner=${ownerA.id}`)
      .set('Authorization', bearer(admin.token));
    expect(filtered.body.total).toBe(2);
    expect(filtered.body.data.every((note: { owner: string }) => note.owner === ownerA.id)).toBe(true);

    const ignored = await request(app)
      .get(`/api/notes?owner=${ownerA.id}`)
      .set('Authorization', bearer(ownerB.token));
    expect(ignored.body.total).toBe(1);
    expect(ignored.body.data[0].title).toBe('B1');
  });

  it('paginates notes newest first', async () => {
    const owner = await registerUser('Paging Note Owner', 'paging-notes@example.com');
    for (let index = 0; index < 12; index += 1) {
      await Note.create({ owner: owner.id, title: `Note ${index}`, content: 'body' });
    }

    const page2 = await request(app)
      .get('/api/notes?page=2&limit=10')
      .set('Authorization', bearer(owner.token));
    expect(page2.body).toMatchObject({ page: 2, total: 12, totalPages: 2 });
    expect(page2.body.data).toHaveLength(2);
  });

  it('validates note payloads and ids', async () => {
    const owner = await registerUser('Note Validator', 'note-validator@example.com');
    expect(
      (
        await request(app)
          .post('/api/notes')
          .set('Authorization', bearer(owner.token))
          .send({ title: '' })
      ).status,
    ).toBe(400);
    expect((await request(app).get('/api/notes/nope').set('Authorization', bearer(owner.token))).status).toBe(400);
  });
});

describe('posts', () => {
  it('creates posts visible to every authenticated user and exposes no write endpoints', async () => {
    const author = await registerUser('Author', 'author@example.com');
    const reader = await registerUser('Reader', 'reader@example.com');

    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', bearer(author.token))
      .send({ title: 'Hello', content: 'World' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ title: 'Hello', content: 'World', author: author.id });

    const list = await request(app).get('/api/posts').set('Authorization', bearer(reader.token));
    expect(list.body.total).toBe(1);

    const id = created.body.data._id;
    expect(
      (await request(app).put(`/api/posts/${id}`).set('Authorization', bearer(author.token)).send({ title: 'x' })).status,
    ).toBe(404);
    expect((await request(app).delete(`/api/posts/${id}`).set('Authorization', bearer(author.token))).status).toBe(404);
  });

  it('requires authentication and validates post payloads', async () => {
    expect((await request(app).get('/api/posts')).status).toBe(401);
    const user = await registerUser('Post Validator', 'post-validator@example.com');
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', bearer(user.token))
      .send({ title: '   ', content: 'ok' });
    expect(response.status).toBe(400);
  });

  it('paginates the post list', async () => {
    const author = await registerUser('Post Pager', 'post-pager@example.com');
    for (let index = 0; index < 12; index += 1) {
      await Post.create({ author: author.id, title: `Post ${index}`, content: 'body' });
    }
    const response = await request(app)
      .get('/api/posts?page=2&limit=10')
      .set('Authorization', bearer(author.token));
    expect(response.body).toMatchObject({ total: 12, totalPages: 2 });
    expect(response.body.data).toHaveLength(2);
  });
});

describe('aggregations', () => {
  it('groups users by interest in exactly one aggregate call (admin only)', async () => {
    const user = await registerUser('Group User', 'group-user@example.com');
    expect((await request(app).get('/api/users/grouped-by-interests').set('Authorization', bearer(user.token))).status).toBe(403);

    const admin = await registerUser('Group Admin', 'group-admin@example.com', ['tech']);
    await promote(admin.id);
    await registerUser('Tech One', 'tech-one@example.com', ['tech', 'music']);
    await registerUser('Tech Two', 'tech-two@example.com', ['tech']);
    await registerUser('Music Only', 'music-only@example.com', ['music']);

    const spy = vi.spyOn(User, 'aggregate');
    const response = await request(app)
      .get('/api/users/grouped-by-interests')
      .set('Authorization', bearer(admin.token));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'tech', count: 3 }),
        expect.objectContaining({ _id: 'music', count: 2 }),
      ]),
    );
    expect(response.body.total).toBe(2);
    expect(response.body.data[0].users[0]).toEqual(
      expect.objectContaining({ name: expect.any(String), email: expect.any(String) }),
    );
  });

  it('applies the optional interest filter with the same single aggregate call', async () => {
    const admin = await registerUser('Filter Admin', 'filter-admin@example.com', ['tech']);
    await promote(admin.id);
    await registerUser('Filtered Tech', 'filtered-tech@example.com', ['tech', 'travel']);

    const spy = vi.spyOn(User, 'aggregate');
    const response = await request(app)
      .get('/api/users/grouped-by-interests?interest=TECH')
      .set('Authorization', bearer(admin.token));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ _id: 'tech', count: 2 });
  });

  it('lists a user posts with one $lookup aggregation pipeline', async () => {
    const user = await registerUser('Lookup User', 'lookup@example.com');
    const other = await registerUser('Other Author', 'other-author@example.com');
    const posts = await Post.create([
      { author: user.id, title: 'First', content: 'a' },
      { author: user.id, title: 'Second', content: 'b' },
      { author: user.id, title: 'Third', content: 'c' },
      { author: other.id, title: 'Foreign', content: 'd' },
    ]);

    const spy = vi.spyOn(User, 'aggregate');
    const response = await request(app)
      .get(`/api/users/${user.id}/posts?page=1&limit=2`)
      .set('Authorization', bearer(other.token));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ _id: user.id, email: 'lookup@example.com' });
    expect(response.body.data.map((post: { _id: string }) => post._id)).toEqual([
      posts[2]._id.toString(),
      posts[1]._id.toString(),
    ]);
    expect(response.body).toMatchObject({ total: 3, totalPages: 2, page: 1, limit: 2 });
  });

  it('validates the lookup id', async () => {
    const user = await registerUser('Lookup Validator', 'lookup-validator@example.com');
    const response = await request(app)
      .get('/api/users/bad-id/posts')
      .set('Authorization', bearer(user.token));
    expect(response.status).toBe(400);
  });
});

describe('declared indexes', () => {
  it('defines exactly the expected indexes on every model', async () => {
    const names = async (collection: { indexes: () => Promise<Array<{ name?: string }>> }) =>
      (await collection.indexes()).map((index) => index.name).sort();

    expect(await names(User.collection)).toEqual(['_id_', 'email_1', 'interests_1']);
    expect(await names(Note.collection)).toEqual(['_id_', 'owner_1__id_-1']);
    expect(await names(Post.collection)).toEqual(['_id_', 'author_1__id_-1']);
  });

  it('enforces the unique email index', async () => {
    await createUserDirect('unique@example.com');
    await expect(createUserDirect('unique@example.com')).rejects.toMatchObject({ code: 11000 });
  });
});

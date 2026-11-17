# Secure Note-Taking API

A REST API for notes, posts, user administration, and two MongoDB aggregations. Built with TypeScript, Node.js, Express 5, MongoDB + Mongoose 9, JWT, bcrypt, and Zod.

## Repositories

- Backend: this repository (`note-taker.backend`)
- Frontend: `../note-taker.frontend` (React + Vite)

The backend is API-only; it never serves frontend assets.

## Local MongoDB

MongoDB 9.0.8 is installed in this environment at:

```text
~/mongodb/mongodb-macos-aarch64--9.0.8/bin/mongod
```

Data directory: `~/.local/share/note-taker-mongodb`

Start it (macOS does not support `mongod --fork`):

```bash
~/mongodb/mongodb-macos-aarch64--9.0.8/bin/mongod \
  --dbpath "$HOME/.local/share/note-taker-mongodb" \
  --logpath "$HOME/.local/share/note-taker-mongodb/mongod.log" \
  --bind_ip 127.0.0.1 --port 27017
```

Or run it in the background:

```bash
nohup ~/mongodb/mongodb-macos-aarch64--9.0.8/bin/mongod \
  --dbpath "$HOME/.local/share/note-taker-mongodb" \
  --logpath "$HOME/.local/share/note-taker-mongodb/mongod.log" \
  --bind_ip 127.0.0.1 --port 27017 >/dev/null 2>&1 &
```

### Managed by launchd (current setup)

A user LaunchAgent at `~/Library/LaunchAgents/com.notetaker.mongodb.plist` starts MongoDB at login and restarts it automatically if the process is killed. Useful commands:

```bash
# Start / reload
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.notetaker.mongodb.plist
# Stop
launchctl bootout gui/$(id -u)/com.notetaker.mongodb
# Inspect
launchctl print gui/$(id -u)/com.notetaker.mongodb
```

MongoDB Compass connection string:

```text
mongodb://127.0.0.1:27017
```

Database: `note_taker`.

> Homebrew's `mongodb-community` formula could not be used because the installed Xcode Command Line Tools are outdated. The official MongoDB macOS binary is used instead and is already running on port 27017.

## Backend setup

```bash
cd note-taker.backend
npm install
cp .env.example .env
# Put a random 32+ character secret in JWT_SECRET
npm run seed:admin
npm run dev
```

API: `http://localhost:4000`

Seeded admin credentials (from `.env`):

```text
admin@example.com / AdminPass123
```

### Optional demo dataset

For planner-realistic `explain()` results:

```bash
npm run seed:demo   # 100 per model (99 demo users + seeded admin), 100 notes, 100 posts
npm run verify:indexes
```

Demo login: `demo1@example.com / Password123`. The demo script removes only accounts matching `demoN@example.com` and their content before reseeding.

### Build

```bash
npm run build
npm start
```

`server.ts` only defines the Express app and mounts routes. The startup logic (MongoDB connection, index sync, `listen`, and signal handlers) lives in [`src/server/start.ts`](src/server/start.ts).

## Frontend

The frontend is a separate application and is served independently:

```bash
cd note-taker.frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5174` and proxies `/api` to `http://localhost:4000`.

For a production-style frontend build, run `npm run build` in `note-taker.frontend` and serve `dist/` with any static host (or `npm run preview`). The backend still only exposes `/api` routes.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `4000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/note_taker` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | required |
| `JWT_EXPIRES_IN` | Token lifetime | `1h` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5174` |
| `ADMIN_NAME` | Seed admin name | `Site Admin` |
| `ADMIN_EMAIL` | Seed admin email | `admin@example.com` |
| `ADMIN_PASSWORD` | Seed admin password | `AdminPass123` |

Admin variables are only used by `npm run seed:admin`; they are optional for the API itself.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Nodemon + tsx, watches TypeScript sources |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | TypeScript check without emitting |
| `npm test` | Run the Vitest integration suite (in-memory MongoDB) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run seed:admin` | Create/promote the first admin (idempotent) |
| `npm run seed:demo` | Generate demo users/notes/posts |
| `npm run verify:indexes` | Assert indexes and run all `explain("executionStats")` checks |

## Testing

```bash
npm test
```

The Vitest suite uses `supertest` against the importable Express app and an in-memory MongoDB (`mongodb-memory-server`), so it needs no running database and does not touch the seeded local data. It covers health/auth, registration validation, login rate limiting, RBAC, full user CRUD, note ownership and admin reads, posts, both aggregation scenarios, pagination, error handling, and declared indexes.

## API

All request bodies, query strings, and route params are validated with Zod. Route params are validated as 24-character ObjectIds.

### Auth and profile

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a `user`. `role` is rejected in the body. |
| POST | `/api/auth/login` | Public, rate-limited | Returns `{ token, user }`. 10 attempts / 15 minutes / IP. |
| GET | `/api/me` | Authenticated | Current user's safe profile. |

### Notes

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/notes` | Authenticated | Create a note owned by the caller. |
| GET | `/api/notes?page=&limit=` | Authenticated | Own notes. Admin sees all; optional `?owner=<ObjectId>`. |
| GET | `/api/notes/:id` | Authenticated | Own note, or any note for admin. |
| PUT | `/api/notes/:id` | Owner only | Update title/content. Admin read access does not grant writes. |
| DELETE | `/api/notes/:id` | Owner only | Delete own note. |

Non-admins cannot use `?owner=` to see another user's notes; the filter is ignored and the query is forced to their own `_id`.

### Users (admin only)

| Method | Path | Description |
|---|---|---|
| POST | `/api/users` | Create a user, including role and interests. |
| GET | `/api/users?page=&limit=` | Paginated users, newest first. |
| GET | `/api/users/:id` | Single user. |
| PUT | `/api/users/:id` | Update name/email/role/interests/password. |
| DELETE | `/api/users/:id` | Delete user. Notes/posts are intentionally not cascade-deleted. |

### Posts

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/posts` | Authenticated | Create a post authored by the caller. |
| GET | `/api/posts?page=&limit=` | Authenticated | Paginated posts, newest first. |

Posts intentionally have no update/delete endpoints; the specification only requires create and list.

### Aggregations

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/users/grouped-by-interests?page=&limit=&interest=` | Admin | Users grouped by interest. Exactly one `User.aggregate()` call. |
| GET | `/api/users/:id/posts?page=&limit=` | Authenticated | Paginated posts by user via `$lookup`. Projects only safe user fields. |

`/grouped-by-interests` is mounted before the admin `/:id` CRUD router so it is not captured as a user id.

## Pagination

Every list endpoint accepts:

- `page` — integer ≥ 1, default `1`
- `limit` — integer 1–100, default `10`

Response shape:

```json
{
  "data": [],
  "page": 1,
  "limit": 10,
  "total": 0,
  "totalPages": 0
}
```

Lists are sorted by `_id: -1` (ObjectIds are time-ordered) with `skip`/`limit`. `totalPages` is `0` when there are no documents; requesting a page beyond the end returns an empty `data` array.

## Index strategy

Custom indexes are declared with `schema.index()` in the model files, each with a comment stating the query it serves. `_id_` is MongoDB's implicit index and is not redeclared.

| Model | Index | Serves |
|---|---|---|
| User | `{ email: 1 }` unique | Login lookup and unique-email enforcement |
| User | `{ interests: 1 }` (multikey) | Interests aggregation `$match` on a specific interest |
| Note | `{ owner: 1, _id: -1 }` | Own-notes list and admin owner filter, newest first |
| Post | `{ author: 1, _id: -1 }` | `$lookup` posts by user and author listings |

No extra indexes were added:

- `GET /api/notes/:id`, `GET /api/me`, and `GET /api/users/:id` use the default `_id_` index.
- Admin "all notes", "all users", and "all posts" sort by `_id: -1` and use the default `_id_` index backward scan.
- No indexes on `createdAt`, `role`, `name`, `title`, or `content`.
- Ownership checks for single notes happen after the `_id` lookup.

`npm run verify:indexes` asserts that each collection contains exactly `_id_` plus the indexes above, then runs every read/list/aggregation query with `explain("executionStats")`.

## Explain evidence

Captured with MongoDB 9.0.8 against 100 users, 100 notes, and 100 posts. Full output: [`docs/explain-results.md`](docs/explain-results.md).

| Query | Expected index | Observed | keysExamined | docsExamined | nReturned | Result |
|---|---|---|---|---|---|---|
| Login: `User.findOne({ email })` | `email_1` | `email_1` | 1 | 1 | 1 | PASS |
| Own notes: `Note.find({ owner }).sort({ _id: -1 })` | `owner_1__id_-1` | `owner_1__id_-1` | 2 | 2 | 2 | PASS |
| Admin notes by owner | `owner_1__id_-1` | `owner_1__id_-1` | 2 | 2 | 2 | PASS |
| Admin all notes | `_id_` | `_id_` | 10 | 10 | 10 | PASS |
| Note by id | `_id_` | `_id_` | 1 | 1 | 1 | PASS |
| Admin users list | `_id_` | `_id_` | 10 | 10 | 10 | PASS |
| Profile / user by id | `_id_` | `_id_` | 1 | 1 | 1 | PASS |
| Posts list | `_id_` | `_id_` | 10 | 10 | 10 | PASS |
| Interests aggregation, filtered by `tech` | `interests_1` | `interests_1` | 50 | 50 | 50 | PASS |
| Interests aggregation, no filter | documented scan | `COLLSCAN` | 0 | 100 | 100 | PASS (expected) |
| Posts by user `$lookup` | `author_1__id_-1` | `_id_`, `author_1__id_-1` | 1 | 1 | 1 | PASS |

### Honest aggregation note

Grouping every user by interest cannot use a single index: `$unwind` + `$group` must inspect every user document. The unfiltered scenario therefore performs a collection scan. When `?interest=` is supplied, the pre-`$unwind` `$match` uses the `interests_1` multikey index and narrows the input. A second `$match` after `$unwind` ensures only the requested interest group is returned.

For posts by user, the `$lookup` uses `let` and a `$match` with `$expr` on `author`. Explain confirms `author_1__id_-1` is used by the correlated lookup.

## Aggregation design

### Users grouped by interests

Single `User.aggregate()` call:

1. Optional indexed `$match { interests }`
2. `$unwind "$interests"`
3. Optional second `$match { interests }` for an exact group
4. `$group` with `users` and `count`
5. `$facet` with `data` (sort/skip/limit) and `meta` (`$count`)
6. `$project` total from the facet

`$facet` supplies the total without a second count query, preserving the pagination contract with exactly one aggregate call.

### Posts by user

Single pipeline:

1. `$match { _id }`
2. `$lookup` with `let`, `$match` on `author`, `$sort { _id: -1 }`, `$skip`, `$limit`
3. A second small `$lookup` with `$count` for the total
4. `$project` only `_id`, `name`, `email`, `interests`, `posts`, `total`

The response is the standard paginated shape plus a safe `user` object. `passwordHash` is never projected.

## Security

- bcrypt cost factor **12**; passwords are capped at 72 characters because bcrypt ignores further bytes.
- `passwordHash` is `select: false` and removed by a `toJSON` transform as defense in depth. Aggregation projections also list safe fields explicitly.
- JWT is read only from `Authorization: Bearer <token>`. `JWT_SECRET` and expiry come from `.env`.
- `authenticate` reloads the user from MongoDB on each request, so role changes and deleted accounts take effect immediately.
- `authorizeRoles('admin')` guards admin routes. Registration rejects `role` via a strict Zod schema, and only the admin user endpoints can change roles.
- Zod validates bodies (strict, preventing mass assignment), queries, and params; ObjectIds are format-checked.
- helmet, CORS, and login-only rate limiting (10 attempts / 15 minutes / IP) are enabled.
- Login uses a generic `Invalid email or password` response for both unknown emails and wrong passwords.

## Design decisions

- **Admin note access is read-only for other users' notes.** The spec grants admins "view everyone's notes"; PUT/DELETE remain owner-only. Attempts return `403`.
- **`403` for another user's note** (instead of `404`) makes the ownership rule explicit. The note must exist because ownership is checked after the `_id` lookup.
- **Non-admin `?owner=` is ignored**, not an error, and the query is forced to the caller's `_id`.
- **No cascade deletes.** Deleting a user leaves their notes/posts. This matches the spec and avoids extra indexes; the frontend warns the admin.
- **No post update/delete.** The spec defines only create and list.
- **Interests are trimmed, lowercased, and deduplicated** so grouping counts are stable.
- **`totalPages` is `0` for an empty collection.** Page numbers beyond the last return empty data.
- **Dev index sync.** `server.ts` calls `syncIndexes()` outside production so local indexes exactly match the four declarations.
- **Token storage in the React app is `localStorage`.** This is acceptable for the interview exercise; production would prefer an HttpOnly cookie.

## Quick manual check

```bash
# Health
curl http://localhost:4000/api/health

# Login as admin
curl -s http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"AdminPass123"}'

# Register a user (role is ignored/rejected)
curl -s http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"Password123","interests":["tech","music"]}'
```

Use the returned token as `Authorization: Bearer <token>` for protected routes. A full smoke test covering auth, ownership, pagination, admin CRUD, posts, both aggregations, and error cases was run against this build.

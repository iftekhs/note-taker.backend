# Index verification evidence

Generated: 2026-11-17T12:02:47.691Z

MongoDB: 9.0.8 · Dataset: 100 users, 100 notes, 100 posts

| Query | Expected index | Observed index(es) | Plan stages | keysExamined | docsExamined | nReturned | Verdict |
|---|---|---|---|---|---|---|---|
| Login lookup: User.findOne({ email }) | email_1 | email_1 | EXPRESS_IXSCAN | 1 | 1 | 1 | PASS |
| Own notes: Note.find({ owner }).sort({ _id: -1 }) | owner_1__id_-1 | owner_1__id_-1 | LIMIT > FETCH > IXSCAN | 2 | 2 | 2 | PASS |
| Admin notes by owner: Note.find({ owner }).sort({ _id: -1 }) | owner_1__id_-1 | owner_1__id_-1 | LIMIT > FETCH > IXSCAN | 2 | 2 | 2 | PASS |
| Admin all notes: Note.find().sort({ _id: -1 }) | _id_ | _id_ | LIMIT > FETCH > IXSCAN | 10 | 10 | 10 | PASS |
| Note by id: Note.findById(id) | _id_ | _id_ | EXPRESS_IXSCAN | 1 | 1 | 1 | PASS |
| Admin users list: User.find().sort({ _id: -1 }) | _id_ | _id_ | LIMIT > PROJECTION_SIMPLE > FETCH > IXSCAN | 10 | 10 | 10 | PASS |
| Profile / user by id: User.findById(id) | _id_ | _id_ | EXPRESS_IXSCAN | 1 | 1 | 1 | PASS |
| Posts list: Post.find().sort({ _id: -1 }) | _id_ | _id_ | LIMIT > FETCH > IXSCAN | 10 | 10 | 10 | PASS |
| Grouped by interests (filtered: tech) | interests_1 | interests_1 | PROJECTION_SIMPLE > FETCH > IXSCAN | 50 | 50 | 50 | PASS |
| Grouped by interests (no filter) | none (documented scan) | (none) | PROJECTION_SIMPLE > COLLSCAN | 0 | 100 | 100 | PASS |
| Posts by user ($lookup with let + $match on author) | author_1__id_-1 | _id_, author_1__id_-1 | EXPRESS_IXSCAN | 1 | 1 | 1 | PASS |

> The unfiltered interests aggregation intentionally scans users: grouping every interest cannot use a single index. The multikey `interests_1` index is used when an interest filter is supplied. The admin "all notes", "all users" and "all posts" lists use the default `_id` index (backward scan), so no extra indexes are needed.

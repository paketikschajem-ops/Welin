const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { customAlphabet } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'welin-super-secret-key';
const db = new Database(path.join(__dirname, 'welin.db'));
const genId = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 12);
const recoveryWords = [
  'aurora', 'river', 'forest', 'bridge', 'silver', 'planet', 'horizon', 'comet', 'lunar',
  'echo', 'velvet', 'pixel', 'ocean', 'ember', 'crystal', 'falcon', 'storm', 'atlas',
  'matrix', 'spectrum', 'quantum', 'zenith', 'ember', 'prairie', 'nebula', 'canvas',
  'voyage', 'summit', 'glacier', 'thunder', 'cipher', 'meadow', 'signal', 'anchor'
];

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      recovery_phrase TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      UNIQUE(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(post_id) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(post_id) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES users(id),
      FOREIGN KEY(following_id) REFERENCES users(id)
    );
  `);
}

function generateRecoveryPhrase() {
  const words = [];
  for (let i = 0; i < 6; i++) {
    words.push(recoveryWords[Math.floor(Math.random() * recoveryWords.length)]);
  }
  return words.join('-');
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, banned FROM users WHERE id = ?').get(payload.id);
    if (!user || user.banned) return res.status(403).json({ error: 'Access denied' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function admin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  return next();
}

function moderateText(text) {
  const blocked = ['spamlink', 'hateword', 'scam'];
  const lower = String(text || '').toLowerCase();
  return blocked.some((word) => lower.includes(word));
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username >= 3 and password >= 6' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const id = genId();
  const hash = bcrypt.hashSync(password, 10);
  const recoveryPhrase = generateRecoveryPhrase();
  const role = username.toLowerCase() === 'welin' ? 'admin' : 'user';

  db.prepare(
    'INSERT INTO users (id, username, password_hash, recovery_phrase, role) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, hash, recoveryPhrase, role);

  return res.status(201).json({ recoveryPhrase, role });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db
    .prepare('SELECT id, username, password_hash, role, banned FROM users WHERE username = ?')
    .get(username);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({ error: 'You are banned' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/reset-password', (req, res) => {
  const { username, recoveryPhrase, newPassword } = req.body;
  if (!username || !recoveryPhrase || !newPassword) {
    return res.status(400).json({ error: 'username, recoveryPhrase, newPassword are required' });
  }

  const user = db.prepare('SELECT id, recovery_phrase FROM users WHERE username = ?').get(username);
  if (!user || user.recovery_phrase !== recoveryPhrase) {
    return res.status(400).json({ error: 'Invalid recovery phrase' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  return res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const me = db.prepare('SELECT id, username, avatar_url, bio, role FROM users WHERE id = ?').get(req.user.id);

  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following,
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts
  `).get(req.user.id, req.user.id, req.user.id);

  return res.json({ ...me, ...counts });
});

app.put('/api/profile', auth, (req, res) => {
  const { avatarUrl = '', bio = '' } = req.body;
  db.prepare('UPDATE users SET avatar_url = ?, bio = ? WHERE id = ?').run(avatarUrl, bio.slice(0, 180), req.user.id);
  return res.json({ ok: true });
});

app.get('/api/users/search', auth, (req, res) => {
  const q = `%${(req.query.q || '').toString().trim()}%`;
  const rows = db.prepare(`
    SELECT id, username, avatar_url, bio
    FROM users
    WHERE username LIKE ? AND banned = 0
    ORDER BY username ASC
    LIMIT 20
  `).all(q);

  return res.json(rows);
});

app.post('/api/follow/:userId', auth, (req, res) => {
  const { userId } = req.params;
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const target = db.prepare('SELECT id FROM users WHERE id = ? AND banned = 0').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, userId);

  if (existing) {
    db.prepare('DELETE FROM follows WHERE id = ?').run(existing.id);
    return res.json({ following: false });
  }

  db.prepare('INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)').run(genId(), req.user.id, userId);
  return res.json({ following: true });
});

app.post('/api/posts', auth, (req, res) => {
  const { content = '', imageUrl = '' } = req.body;
  if (!content.trim()) return res.status(400).json({ error: 'Post content required' });
  if (moderateText(content)) return res.status(400).json({ error: 'Content violates moderation policy' });

  db.prepare('INSERT INTO posts (id, user_id, content, image_url) VALUES (?, ?, ?, ?)')
    .run(genId(), req.user.id, content.slice(0, 1200), imageUrl.slice(0, 1000));

  return res.status(201).json({ ok: true });
});

app.get('/api/feed', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      p.id,
      p.content,
      p.image_url,
      p.created_at,
      u.id AS user_id,
      u.username,
      u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = @viewer) AS liked,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE u.banned = 0
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all({ viewer: req.user.id });

  return res.json(rows);
});

app.post('/api/posts/:postId/like', auth, (req, res) => {
  const { postId } = req.params;
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, postId);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
    return res.json({ liked: false });
  }

  db.prepare('INSERT INTO likes (id, user_id, post_id) VALUES (?, ?, ?)').run(genId(), req.user.id, postId);
  return res.json({ liked: true });
});

app.get('/api/posts/:postId/comments', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.postId);

  return res.json(rows);
});

app.post('/api/posts/:postId/comments', auth, (req, res) => {
  const { content = '' } = req.body;
  const { postId } = req.params;

  if (!content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (moderateText(content)) return res.status(400).json({ error: 'Comment violates moderation policy' });

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('INSERT INTO comments (id, user_id, post_id, content) VALUES (?, ?, ?, ?)')
    .run(genId(), req.user.id, postId, content.slice(0, 500));

  return res.status(201).json({ ok: true });
});

app.get('/api/users/:username', auth, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, avatar_url, bio
    FROM users
    WHERE username = ? AND banned = 0
  `).get(req.params.username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE following_id = @id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = @id) AS following,
      (SELECT COUNT(*) FROM posts WHERE user_id = @id) AS posts,
      EXISTS (SELECT 1 FROM follows WHERE follower_id = @viewer AND following_id = @id) AS is_following
  `).get({ id: user.id, viewer: req.user.id });

  const posts = db.prepare(`
    SELECT id, content, image_url, created_at,
      (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) AS comments_count
    FROM posts
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(user.id);

  return res.json({ user, stats, posts });
});

app.get('/api/admin/users', auth, admin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, banned, created_at,
      (SELECT COUNT(*) FROM posts WHERE user_id = users.id) AS posts
    FROM users
    ORDER BY created_at DESC
  `).all();

  return res.json(users);
});

app.get('/api/admin/posts', auth, admin, (req, res) => {
  const posts = db.prepare(`
    SELECT p.id, p.content, p.created_at, u.username
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `).all();

  return res.json(posts);
});

app.delete('/api/admin/posts/:postId', auth, admin, (req, res) => {
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.postId);
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.postId);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.postId);
  return res.json({ ok: true });
});

app.post('/api/admin/ban/:userId', auth, admin, (req, res) => {
  db.prepare('UPDATE users SET banned = 1 WHERE id = ? AND role != "admin"').run(req.params.userId);
  db.prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?').run(req.params.userId, req.params.userId);
  return res.json({ ok: true });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

initDb();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WELIN server running on http://localhost:${PORT}`);
});

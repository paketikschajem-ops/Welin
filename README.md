# WELIN — Social Network

WELIN is a full-stack social platform with a modern glassmorphism UI inspired by Instagram + X + minimal aesthetic.

## Features

- Registration with username + password (no email)
- Auto-generated recovery phrase for password reset
- Authenticated social feed (text + image URL posts)
- Likes, comments, follow/unfollow
- User profile (avatar, bio, posts, followers/following)
- User search
- Dark/light theme toggle
- RU/EN language switch
- Admin role for `welin` username:
  - Ban users
  - Delete posts
  - See all accounts
  - Content moderation hooks

## Tech

- Node.js + Express
- SQLite (`better-sqlite3`)
- Vanilla JS frontend with responsive layout and animations

## Run

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Security notes

- Passwords are hashed with bcrypt
- JWT auth for API access
- Basic moderation checks for posts/comments
- Input escaping in frontend rendering

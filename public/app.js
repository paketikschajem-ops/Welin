const state = {
  token: localStorage.getItem('welin_token') || '',
  me: null,
  lang: localStorage.getItem('welin_lang') || 'ru',
  theme: localStorage.getItem('welin_theme') || 'dark',
};

const t = {
  en: {
    login: 'Login', register: 'Register', username: 'Username', password: 'Password',
    recovery: 'Recovery phrase', newPassword: 'New password', resetPassword: 'Reset password',
    logout: 'Logout', bio: 'Bio', avatar: 'Avatar URL', saveProfile: 'Save profile',
    createPost: 'Create post', imageUrl: 'Image URL', content: 'Content', publish: 'Publish',
    search: 'Search users', follow: 'Follow / Unfollow', feed: 'Feed', comments: 'Comments',
    addComment: 'Add comment', likes: 'Likes', adminPanel: 'Admin panel',
    users: 'Users', posts: 'Posts', ban: 'Ban', deletePost: 'Delete',
    followers: 'Followers', following: 'Following', myProfile: 'My profile',
    themeLight: 'Light', themeDark: 'Dark', registerHint: 'After registration, save your recovery phrase securely.',
    moderation: 'Moderation is active for posts and comments.',
  },
  ru: {
    login: 'Вход', register: 'Регистрация', username: 'Логин', password: 'Пароль',
    recovery: 'Секретная фраза', newPassword: 'Новый пароль', resetPassword: 'Сбросить пароль',
    logout: 'Выйти', bio: 'Био', avatar: 'URL аватара', saveProfile: 'Сохранить профиль',
    createPost: 'Создать пост', imageUrl: 'URL изображения', content: 'Текст', publish: 'Опубликовать',
    search: 'Поиск пользователей', follow: 'Подписаться / Отписаться', feed: 'Лента', comments: 'Комментарии',
    addComment: 'Добавить комментарий', likes: 'Лайки', adminPanel: 'Админка',
    users: 'Пользователи', posts: 'Посты', ban: 'Бан', deletePost: 'Удалить',
    followers: 'Подписчики', following: 'Подписки', myProfile: 'Мой профиль',
    themeLight: 'Светлая', themeDark: 'Тёмная', registerHint: 'После регистрации сохраните секретную фразу в безопасном месте.',
    moderation: 'Модерация активна для постов и комментариев.',
  }
};

const $ = (id) => document.getElementById(id);

function tr(key) {
  return t[state.lang][key] || key;
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', state.theme === 'dark');
  $('themeToggle').textContent = state.theme === 'dark' ? tr('themeLight') : tr('themeDark');
}

function notify(message) {
  window.alert(message);
}

function formatDate(v) {
  return new Date(v).toLocaleString(state.lang === 'ru' ? 'ru-RU' : 'en-US');
}

function authView() {
  $('authSection').innerHTML = `
    <h2>WELIN</h2>
    <p class="meta">${tr('registerHint')}</p>
    <div class="form" style="margin-top:10px">
      <h3>${tr('register')}</h3>
      <input id="regUsername" placeholder="${tr('username')}" />
      <input id="regPassword" type="password" placeholder="${tr('password')}" />
      <button class="btn primary" id="registerBtn">${tr('register')}</button>
      <h3 style="margin-top:8px">${tr('login')}</h3>
      <input id="loginUsername" placeholder="${tr('username')}" />
      <input id="loginPassword" type="password" placeholder="${tr('password')}" />
      <button class="btn primary" id="loginBtn">${tr('login')}</button>
      <h3 style="margin-top:8px">${tr('resetPassword')}</h3>
      <input id="resetUsername" placeholder="${tr('username')}" />
      <input id="resetPhrase" placeholder="${tr('recovery')}" />
      <input id="resetNewPassword" type="password" placeholder="${tr('newPassword')}" />
      <button class="btn" id="resetBtn">${tr('resetPassword')}</button>
    </div>
  `;

  $('registerBtn').onclick = async () => {
    try {
      const data = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({ username: $('regUsername').value.trim(), password: $('regPassword').value })
      });
      notify(`${tr('recovery')}: ${data.recoveryPhrase}`);
    } catch (e) { notify(e.message); }
  };

  $('loginBtn').onclick = async () => {
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: $('loginUsername').value.trim(), password: $('loginPassword').value })
      });
      state.token = data.token;
      localStorage.setItem('welin_token', state.token);
      await bootApp();
    } catch (e) { notify(e.message); }
  };

  $('resetBtn').onclick = async () => {
    try {
      await api('/api/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          username: $('resetUsername').value.trim(),
          recoveryPhrase: $('resetPhrase').value.trim(),
          newPassword: $('resetNewPassword').value,
        })
      });
      notify('OK');
    } catch (e) { notify(e.message); }
  };
}

async function loadMe() {
  state.me = await api('/api/me');
}

function meCard() {
  $('meCard').innerHTML = `
    <div class="row">
      <img class="avatar" src="${state.me.avatar_url || ''}" onerror="this.style.display='none'" />
      <div>
        <h3>@${state.me.username}</h3>
        <p class="meta">${tr('followers')}: ${state.me.followers} · ${tr('following')}: ${state.me.following}</p>
      </div>
    </div>
    <p style="margin-top:10px">${state.me.bio || ''}</p>
  `;
  $('logoutBtn').textContent = tr('logout');
  $('logoutBtn').onclick = () => {
    state.token = '';
    localStorage.removeItem('welin_token');
    render();
  };
}

function composer() {
  $('composer').innerHTML = `
    <h3>${tr('createPost')}</h3>
    <div class="form">
      <textarea id="postContent" placeholder="${tr('content')}"></textarea>
      <input id="postImage" placeholder="${tr('imageUrl')}" />
      <button id="publishBtn" class="btn primary">${tr('publish')}</button>
      <p class="meta">${tr('moderation')}</p>
    </div>
  `;
  $('publishBtn').onclick = async () => {
    try {
      await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content: $('postContent').value, imageUrl: $('postImage').value.trim() })
      });
      $('postContent').value = '';
      $('postImage').value = '';
      await feed();
      await myProfile();
    } catch (e) { notify(e.message); }
  };
}

async function searchUsers() {
  $('search').innerHTML = `
    <h3>${tr('search')}</h3>
    <div class="row">
      <input id="searchInput" placeholder="@username" />
      <button id="searchBtn" class="btn">OK</button>
    </div>
    <div id="searchResults"></div>
  `;

  $('searchBtn').onclick = async () => {
    const q = $('searchInput').value.trim();
    try {
      const users = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
      $('searchResults').innerHTML = users.map((u) => `
        <div class="post">
          <div class="row between">
            <div class="row">
              <img class="avatar" src="${u.avatar_url || ''}" onerror="this.style.display='none'" />
              <div><strong>@${u.username}</strong><div class="meta">${u.bio || ''}</div></div>
            </div>
            <button class="btn" data-follow="${u.id}">${tr('follow')}</button>
          </div>
        </div>
      `).join('') || '<p class="meta">Empty</p>';

      [...$('searchResults').querySelectorAll('[data-follow]')].forEach((b) => {
        b.onclick = async () => {
          try {
            await api(`/api/follow/${b.dataset.follow}`, { method: 'POST' });
            await loadMe();
            meCard();
          } catch (e) { notify(e.message); }
        };
      });
    } catch (e) { notify(e.message); }
  };
}

async function feed() {
  const posts = await api('/api/feed');

  $('feed').innerHTML = `<h3>${tr('feed')}</h3>` + posts.map((p) => `
    <article class="post">
      <div class="row between">
        <div class="row">
          <img class="avatar" src="${p.avatar_url || ''}" onerror="this.style.display='none'" />
          <div><strong>@${p.username}</strong><div class="meta">${formatDate(p.created_at)}</div></div>
        </div>
      </div>
      <p>${escapeHtml(p.content)}</p>
      ${p.image_url ? `<img class="post-image" src="${p.image_url}" />` : ''}
      <div class="row" style="margin-top:10px">
        <button data-like="${p.id}" class="btn">❤️ ${tr('likes')}: ${p.likes}</button>
        <button data-open-comments="${p.id}" class="btn">💬 ${tr('comments')}: ${p.comments_count}</button>
      </div>
      <div id="comments-${p.id}" class="hidden"></div>
    </article>
  `).join('');

  [...$('feed').querySelectorAll('[data-like]')].forEach((b) => {
    b.onclick = async () => {
      try {
        await api(`/api/posts/${b.dataset.like}/like`, { method: 'POST' });
        await feed();
      } catch (e) { notify(e.message); }
    };
  });

  [...$('feed').querySelectorAll('[data-open-comments]')].forEach((b) => {
    b.onclick = async () => {
      const postId = b.dataset.openComments;
      const box = $(`comments-${postId}`);
      box.classList.toggle('hidden');
      if (box.dataset.loaded === '1') return;

      const comments = await api(`/api/posts/${postId}/comments`);
      box.innerHTML = `
        <div class="form" style="margin-top:8px">
          <input id="comment-input-${postId}" placeholder="${tr('addComment')}" />
          <button data-send-comment="${postId}" class="btn">${tr('addComment')}</button>
        </div>
        <div>${comments.map((c) => `<p class="meta"><strong>@${c.username}</strong>: ${escapeHtml(c.content)}</p>`).join('')}</div>
      `;
      box.dataset.loaded = '1';

      const sendBtn = box.querySelector(`[data-send-comment='${postId}']`);
      sendBtn.onclick = async () => {
        try {
          await api(`/api/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content: $(`comment-input-${postId}`).value })
          });
          await feed();
        } catch (e) { notify(e.message); }
      };
    };
  });
}

async function myProfile() {
  const profile = await api(`/api/users/${state.me.username}`);

  $('profile').innerHTML = `
    <h3>${tr('myProfile')}</h3>
    <div class="form">
      <input id="avatarInput" placeholder="${tr('avatar')}" value="${state.me.avatar_url || ''}" />
      <textarea id="bioInput" placeholder="${tr('bio')}">${state.me.bio || ''}</textarea>
      <button id="saveProfileBtn" class="btn">${tr('saveProfile')}</button>
    </div>
    <p class="meta" style="margin-top:10px">${tr('followers')}: ${profile.stats.followers} · ${tr('following')}: ${profile.stats.following} · Posts: ${profile.stats.posts}</p>
    ${profile.posts.map((p) => `<div class="post"><p>${escapeHtml(p.content)}</p></div>`).join('')}
  `;

  $('saveProfileBtn').onclick = async () => {
    try {
      await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: $('avatarInput').value.trim(), bio: $('bioInput').value })
      });
      await loadMe();
      meCard();
      await myProfile();
    } catch (e) { notify(e.message); }
  };
}

async function adminPanel() {
  if (state.me.role !== 'admin') {
    $('adminPanel').classList.add('hidden');
    return;
  }

  const [users, posts] = await Promise.all([api('/api/admin/users'), api('/api/admin/posts')]);
  $('adminPanel').classList.remove('hidden');
  $('adminPanel').innerHTML = `
    <h3>${tr('adminPanel')}</h3>
    <h4>${tr('users')}</h4>
    ${users.map((u) => `
      <div class="post row between">
        <div>@${u.username} · ${u.role} · posts: ${u.posts} · banned: ${u.banned ? 'yes' : 'no'}</div>
        <button class="btn danger" data-ban="${u.id}">${tr('ban')}</button>
      </div>
    `).join('')}
    <h4>${tr('posts')}</h4>
    ${posts.map((p) => `
      <div class="post row between">
        <div><strong>@${p.username}</strong> — ${escapeHtml(p.content)}</div>
        <button class="btn danger" data-delete-post="${p.id}">${tr('deletePost')}</button>
      </div>
    `).join('')}
  `;

  [...$('adminPanel').querySelectorAll('[data-ban]')].forEach((b) => {
    b.onclick = async () => {
      await api(`/api/admin/ban/${b.dataset.ban}`, { method: 'POST' });
      await adminPanel();
    };
  });

  [...$('adminPanel').querySelectorAll('[data-delete-post]')].forEach((b) => {
    b.onclick = async () => {
      await api(`/api/admin/posts/${b.dataset.deletePost}`, { method: 'DELETE' });
      await adminPanel();
      await feed();
    };
  });
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function bootApp() {
  try {
    await loadMe();
    $('authSection').classList.add('hidden');
    $('appSection').classList.remove('hidden');

    meCard();
    composer();
    await searchUsers();
    await myProfile();
    await feed();
    await adminPanel();
  } catch {
    state.token = '';
    localStorage.removeItem('welin_token');
    render();
  }
}

function render() {
  $('langSelect').value = state.lang;
  applyTheme();
  if (!state.token) {
    $('appSection').classList.add('hidden');
    $('authSection').classList.remove('hidden');
    authView();
  } else {
    bootApp();
  }
}

$('langSelect').onchange = () => {
  state.lang = $('langSelect').value;
  localStorage.setItem('welin_lang', state.lang);
  render();
};

$('themeToggle').onclick = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('welin_theme', state.theme);
  applyTheme();
};

render();

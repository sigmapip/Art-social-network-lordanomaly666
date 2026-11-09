const express = require('express');
const multer = require('multer');
const path = require('path');
const { Client } = require('pg');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const ADMIN_PASSWORD = "90684e3";

// Подключение к базе данных PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('Успешное подключение к PostgreSQL');
    return client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id BIGINT PRIMARY KEY,
        title TEXT,
        author TEXT,
        image TEXT,
        likes INT DEFAULT 0,
        admin_likes INT DEFAULT 0,
        liked_by TEXT DEFAULT '[]',
        admin_liked_by TEXT DEFAULT '[]',
        is_admin_post BOOLEAN DEFAULT false
      );
    `);
  })
  .catch(err => console.error('Ошибка базы данных:', err));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Главная страница
app.get('/', async (req, res) => {
  try {
    const dbRes = await client.query('SELECT * FROM posts ORDER BY admin_likes DESC, id DESC');
    const dbPosts = dbRes.rows;

    let postsHtml = dbPosts.map(post => {
      const adminBadge = post.is_admin_post ? '<span class="admin-badge">✔️ Администратор</span>' : '';
      const likesCount = post.likes || 0;
      const adminLikesCount = post.admin_likes || 0;

      return `
      <div class="post" id="post-${post.id}">
        <img src="${post.image}" alt="${post.title}">
        <div class="post-info">
          <h3>${post.title}</h3>
          <p>Автор: <strong>${post.author}</strong> ${adminBadge}</p>
          <div class="post-actions">
            <button class="btn-like" onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${likesCount}</span></button>
            <span class="admin-heart-display">💙 <span id="admin-like-count-${post.id}">${adminLikesCount}</span></span>
            <button class="btn-admin-action btn-admin-like admin-only" onclick="adminLikePost(${post.id})" style="display:none;">💙 Поставить</button>
            <button class="btn-admin-action btn-delete admin-only" onclick="deletePost(${post.id})" style="display:none;">🗑️ Удалить</button>
          </div>
        </div>
      </div>
      `;
    }).join('');

    if (dbPosts.length === 0) {
      postsHtml = '<p style="text-align:center; color:#999; margin-top:40px;">Лента пока пуста. Будьте первыми!</p>';
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Арт-Соцсеть</title>
        <style>
          body { font-family: sans-serif; background: #fafafa; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .admin-auth-bar { background: #333; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
          .admin-auth-bar input { width: auto; flex-grow: 1; margin: 0; padding: 6px; border: none; border-radius: 4px; }
          .admin-auth-bar button { width: auto; margin: 0; padding: 6px 15px; background: #222; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; }
          .admin-status { font-weight: bold; color: #ffdd57; display: none; }
          header { text-align: center; margin-bottom: 30px; }
          form { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 30px; }
          input, button, textarea { width: 100%; padding: 10px; margin: 5px 0 15px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
          .btn-submit { background: #0095f6; color: white; border: none; font-weight: bold; cursor: pointer; }
          .post { background: white; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 25px; overflow: hidden; }
          .post img { width: 100%; display: block; max-height: 500px; object-fit: contain; background: #f0f0f0; }
          .post-info { padding: 15px; }
          .post-info h3 { margin: 0 0 5px 0; }
          .post-info p { margin: 0 0 15px 0; color: #777; display: flex; align-items: center; gap: 5px; }
          .admin-badge { background: #1d9bf0; color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: bold; }
          .post-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
          .btn-like { width: auto; background: #eee; color: #333; padding: 6px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
          .admin-heart-display { background: #e8f4fd; color: #1d9bf0; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 14px; }
          .btn-admin-action { width: auto; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold; }
          .btn-admin-like { background: #1d9bf0; color: white; border: none; }
          .btn-delete { background: #ffebeb; color: #ff4d4d; border: 1px solid #ffccd0; }
          .timer-screen { display: none; text-align: center; padding: 50px 20px; background: white; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          .timer-val { font-size: 48px; font-weight: bold; color: #ff4d4d; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container" id="main-content">
          <div class="admin-auth-bar">
            <div id="auth-input-zone" style="display: flex; width: 100%; gap: 10px; align-items: center;">
              <label style="font-size: 13px; white-space: nowrap;">Пароль админа:</label>
              <input type="password" id="admin-password-input" placeholder="Введите ключ...">
              <button onclick="checkAdminPassword()">Войти</button>
            </div>
            <div id="auth-success-zone" class="admin-status">⚡ Вы вошли как Администратор</div>
          </div>
          <header>
            <h1>🎨 Наша Арт Соцсеть</h1>
            <p>Поделись своим творчеством!</p>
          </header>
          <form action="/upload" method="POST" enctype="multipart/form-data" onsubmit="return handleFormSubmit(this)">
            <input type="hidden" name="adminPassword" id="form-admin-password" value="">
            <label>Название арта:</label>
            <input type="text" name="title" required placeholder="Например: Ночной пейзаж">
            <label>Ваш никнейм:</label>
            <input type="text" name="author" required placeholder="Например: Художник99">
            <label>Выберите файл арта:</label>
            <input type="file" name="artImage" accept="image/*" required>
            <button type="submit" class="btn-submit">Опубликовать в ленту</button>
          </form>
          <div id="feed">
            ${postsHtml}
          </div>
        </div>
        <div class="container" id="timer-zone" class="timer-screen">
          <h2 style="font-size:32px; margin-bottom:10px;">🛑 Ограничение спама</h2>
          <p style="font-size:16px; color:#666;">Публиковать арты можно раз в 5 минут.</p>
          <div class="timer-val" id="countdown-timer">05:00</div>
          <button onclick="hideTimerScreen()" style="background:#0095f6; color:white; border:none; padding:10px 20px; font-weight:bold; border-radius:5px; cursor:pointer; width:auto;">Вернуться</button>
        </div>
    `);
  } catch (err) {
    res.status(500).send('Ошибка загрузки ленты: ' + err.message);
  }
});
      <script>
        window.onload = function() {
          if (localStorage.getItem('isAdmin') === 'true') {
            showAdminFeatures();
          }
        }

        function handleFormSubmit(form) {
          const isAdmin = localStorage.getItem('isAdmin') === 'true';
          const pass = localStorage.getItem('adminPassword') || '';
          document.getElementById('form-admin-password').value = pass;

          if (isAdmin) return true;

          const lastPost = localStorage.getItem('lastPostTime');
          const now = Date.now();
          const limit = 5 * 60 * 1000;

          if (lastPost && (now - lastPost < limit)) {
            const timeLeftMs = limit - (now - lastPost);
            showTimerScreen(Math.ceil(timeLeftMs / 1000));
            return false;
          }

          localStorage.setItem('lastPostTime', now);
          return true;
        }

        let timerInterval;
        function showTimerScreen(totalSeconds) {
          document.getElementById('main-content').style.display = 'none';
          const timerZone = document.getElementById('timer-zone');
          timerZone.style.display = 'block';

          let secondsLeft = totalSeconds;
          const timerDiv = document.getElementById('countdown-timer');

          clearInterval(timerInterval);
          function updateTimer() {
            if (secondsLeft <= 0) {
              hideTimerScreen();
              return;
            }
            let mins = Math.floor(secondsLeft / 60);
            let secs = secondsLeft % 60;
            timerDiv.innerText = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
            secondsLeft--;
          }

          updateTimer();
          timerInterval = setInterval(updateTimer, 1000);
        }

        function hideTimerScreen() {
          clearInterval(timerInterval);
          document.getElementById('timer-zone').style.display = 'none';
          document.getElementById('main-content').style.display = 'block';
        }

        function checkAdminPassword() {
          const pass = document.getElementById('admin-password-input').value;
          fetch('/auth-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              localStorage.setItem('isAdmin', 'true');
              localStorage.setItem('adminPassword', pass);
              showAdminFeatures();
              location.reload();
            } else {
              alert('Неверный пароль администратора!');
            }
          });
        }

        function showAdminFeatures() {
          const authInput = document.getElementById('auth-input-zone');
          const authSuccess = document.getElementById('auth-success-zone');
          if(authInput) authInput.style.display = 'none';
          if(authSuccess) authSuccess.style.display = 'block';
          
          const adminButtons = document.querySelectorAll('.admin-only');
          adminButtons.forEach(btn => btn.style.display = 'inline-block');
        }

        function likePost(id) {
          fetch('/like/' + id, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                document.getElementById('like-count-' + id).innerText = data.likes;
              } else {
                alert(data.message || 'Ошибка');
              }
            });
        }

        function adminLikePost(id) {
          const pass = localStorage.getItem('adminPassword') || '';
          fetch('/admin-like/' + id, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              document.getElementById('admin-like-count-' + id).innerText = data.adminLikes;
              location.reload();
            } else {
              alert(data.message || 'Доступ запрещен');
            }
          });
        }

        function deletePost(id) {
          if (confirm('Точно удалить этот арт?')) {
            const pass = localStorage.getItem('adminPassword') || '';
            fetch('/delete/' + id, { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: pass })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                location.reload();
              } else {
                alert(data.message || 'Ошибка при удалении');
              }
            });
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Обработка загрузки постов
app.post('/upload', upload.single('artImage'), async (req, res) => {
  if (!req.file) return res.redirect('/');
  
  try {
    const isAdmin = req.body.adminPassword === ADMIN_PASSWORD;
    const base64File = req.file.buffer.toString('base64');
    
    const formData = new URLSearchParams();
    formData.append('image', base64File);

    const imgbbRes = await axios.post(`https://imgbb.com{process.env.IMGBB_API_KEY}`, formData);
    const imageUrl = imgbbRes.data.data.url;

    const postId = Date.now();
    const title = req.body.title || 'Без названия';
    const author = req.body.author || 'Аноним';

    await client.query(
      `INSERT INTO posts (id, title, author, image, likes, admin_likes, liked_by, admin_liked_by, is_admin_post) 
       VALUES ($1, $2, $3, $4, 0, 0, '[]', '[]', $5)`,
      [postId, title, author, imageUrl, isAdmin]
    );

    res.redirect('/');
  } catch (err) {
    console.error('Ошибка публикации:', err);
    res.status(500).send('Не удалось выложить арт. Ошибка: ' + err.message);
  }
});

app.post('/auth-admin', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/like/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    
    const postRes = await client.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) return res.json({ success: false, message: 'Пост не найден' });
    
    const post = postRes.rows[0];
    let likedBy = JSON.parse(post.liked_by || '[]');
    
    if (likedBy.includes(userIp)) {
      return res.json({ success: false, message: 'Вы уже лайкнули этот арт!' });
    }
    
    likedBy.push(userIp);
    const newLikes = (post.likes || 0) + 1;
    
    await client.query('UPDATE posts SET likes = $1, liked_by = $2 WHERE id = $3', [newLikes, JSON.stringify(likedBy), postId]);
    res.json({ success: true, likes: newLikes });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.post('/admin-like/:id', async (req, res) => {
  try {
    if (req.body.password !== ADMIN_PASSWORD) {
      return res.json({ success: false, message: 'Неверный пароль!' });
    }
    
    const postId = req.params.id;
    const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    
    const postRes = await client.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) return res.json({ success: false, message: 'Пост не найден' });
    
    const post = postRes.rows[0];
    let adminLikedBy = JSON.parse(post.admin_liked_by || '[]');
    
    if (adminLikedBy.includes(userIp)) {
      return res.json({ success: false, message: 'Вы уже поставили админ-лайк!' });
    }
    
    adminLikedBy.push(userIp);
    const newAdminLikes = (post.admin_likes || 0) + 1;
    
    await client.query('UPDATE posts SET admin_likes = $1, admin_liked_by = $2 WHERE id = $3', [newAdminLikes, JSON.stringify(adminLikedBy), postId]);
    res.json({ success: true, adminLikes: newAdminLikes });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.post('/delete/:id', async (req, res) => {
  try {
    if (req.body.password !== ADMIN_PASSWORD) {
      return res.json({ success: false, message: 'Доступ запрещен' });
    }
    const postId = req.params.id;
    await client.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});


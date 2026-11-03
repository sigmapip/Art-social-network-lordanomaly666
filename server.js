const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Глобальные базы данных в оперативной памяти сервера
let posts = [
  {
    id: 1,
    title: "Демонстрационный арт",
    author: "Система",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://w3.org' width='100' height='100' viewBox='0 0 100 100'><rect width='100' stroke='%23ccc' stroke-width='2' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%23666'>Здесь будет ваш арт</text></svg>",
    likes: 5,
    adminLikes: 0,
    likedBy: [],      
    adminLikedBy: [],
    isAdminPost: true // Демо-пост сделаем админским для примера
  }
];

const lastPostTime = {}; 
const ADMIN_PASSWORD = "90684e3";
const FLOOD_LIMIT_MS = 5 * 60 * 1000; // 5 минут

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  // Сортировка: сначала арты с админ-лайками (💙), затем новые сверху
  const sortedPosts = [...posts].sort((a, b) => {
    if (b.adminLikes !== a.adminLikes) {
      return b.adminLikes - a.adminLikes;
    }
    return b.id - a.id;
  });

  let postsHtml = sortedPosts.map(post => {
    // Если пост выложен админом, добавляем красивую галочку
    const adminBadge = post.isAdminPost ? '<span class="admin-badge">✔️ Администратор</span>' : '';
    
    return `
    <div class="post" id="post-${post.id}">
      <img src="${post.image}" alt="${post.title}">
      <div class="post-info">
        <h3>${post.title}</h3>
        <p>Автор: <strong>${post.author}</strong> ${adminBadge}</p>
        <div class="post-actions">
          <button class="btn-like" onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${post.likes}</span></button>
          <span class="admin-heart-display">💙 <span id="admin-like-count-${post.id}">${post.adminLikes}</span></span>
          <button class="btn-admin-action btn-admin-like admin-only" onclick="adminLikePost(${post.id})" style="display:none;">💙 Поставить</button>
          <button class="btn-admin-action btn-delete admin-only" onclick="deletePost(${post.id})" style="display:none;">🗑️ Удалить</button>
        </div>
      </div>
    </div>
    `;
  }).join('');

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
      </style>
    </head>
    <body>
      <div class="container">
        
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

        <!-- В форму скрыто добавляем пароль, чтобы сервер знал, публикует ли админ -->
        <form action="/upload" method="POST" enctype="multipart/form-data" onsubmit="addAdminToken(this)">
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

      <script>
        window.onload = function() {
          if (localStorage.getItem('isAdmin') === 'true') {
            showAdminFeatures();
          }
        }

        function addAdminToken(form) {
          const pass = localStorage.getItem('adminPassword') || '';
          document.getElementById('form-admin-password').value = pass;
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
              location.reload(); // Перезагрузка для обновления скрытых полей
            } else {
              alert('Неверный пароль администратора!');
            }
          });
        }

        function showAdminFeatures() {
          document.getElementById('auth-input-zone').style.display = 'none';
          document.getElementById('auth-success-zone').style.display = 'block';
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

// Обработка загрузки нового поста
app.post('/upload', upload.single('artImage'), (req, res) => {
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Сортировка: сначала арты с админ-лайками (💙), затем новые сверху
  const sortedPosts = [...posts].sort((a, b) => {
    if (b.adminLikes !== a.adminLikes) {
      return b.adminLikes - a.adminLikes;
    }
    return b.id - a.id;
  });

  let postsHtml = sortedPosts.map(post => {
    // Если пост выложен админом, добавляем красивую галочку
    const adminBadge = post.isAdminPost ? '<span class="admin-badge">✔️ Администратор</span>' : '';
    
    return `
    <div class="post" id="post-${post.id}">
      <img src="${post.image}" alt="${post.title}">
      <div class="post-info">
        <h3>${post.title}</h3>
        <p>Автор: <strong>${post.author}</strong> ${adminBadge}</p>
        <div class="post-actions">
          <button class="btn-like" onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${post.likes}</span></button>
          <span class="admin-heart-display">💙 <span id="admin-like-count-${post.id}">${post.adminLikes}</span></span>
          <button class="btn-admin-action btn-admin-like admin-only" onclick="adminLikePost(${post.id})" style="display:none;">💙 Поставить</button>
          <button class="btn-admin-action btn-delete admin-only" onclick="deletePost(${post.id})" style="display:none;">🗑️ Удалить</button>
        </div>
      </div>
    </div>
    `;
  }).join('');

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
      </style>
    </head>
    <body>
      <div class="container">
        
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

        <!-- В форму скрыто добавляем пароль, чтобы сервер знал, публикует ли админ -->
        <form action="/upload" method="POST" enctype="multipart/form-data" onsubmit="addAdminToken(this)">
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

      <script>
        window.onload = function() {
          if (localStorage.getItem('isAdmin') === 'true') {
            showAdminFeatures();
          }
        }

        function addAdminToken(form) {
          const pass = localStorage.getItem('adminPassword') || '';
          document.getElementById('form-admin-password').value = pass;
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
              location.reload(); // Перезагрузка для обновления скрытых полей
            } else {
              alert('Неверный пароль администратора!');
            }
          });
        }

        function showAdminFeatures() {
          document.getElementById('auth-input-zone').style.display = 'none';
          document.getElementById('auth-success-zone').style.display = 'block';
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

// Обработка загрузки нового поста
app.post('/upload', upload.single('artImage'), (req, res) => {
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  
  // Проверяем, является ли отправитель админом
  const isAdmin = req.body.adminPassword === ADMIN_PASSWORD;

  // Если НЕ админ — включаем жесткую проверку анти-флуда
  if (!isAdmin && lastPostTime[userIp] && (now - lastPostTime[userIp] < FLOOD_LIMIT_MS)) {
    const timeLeftMs = FLOOD_LIMIT_MS - (now - lastPostTime[userIp]);
    const totalSeconds = Math.ceil(timeLeftMs / 1000);

    // Возвращаем страницу со встроенным живым JS-таймером
    return res.send(`
      <div style="text-align:center; padding:50px; font-family:sans-serif; background:#fafafa; color:#333;">
        <h2 style="font-size:40px; margin-bottom:10px;">🛑 Ограничение спама</h2>
        <p style="font-size:18px; color:#666;">Публиковать арты можно раз в 5 минут.</p>
        <div style="font-size: 48px; font-weight: bold; color: #ff4d4d; margin: 30px 0;" id="timer">--:--</div>
        <a href="/" style="display:inline-block; padding:10px 20px; background:#0095f6; color:white; text-decoration:none; border-radius:5px; font-weight:bold;">На главную</a>
        
        <script>
          let secondsLeft = ${totalSeconds};
          const timerDiv = document.getElementById('timer');
          
          function updateTimer() {
            if (secondsLeft <= 0) {
              window.location.href = "/";
              return;
            }
            let mins = Math.floor(secondsLeft / 60);
            let secs = secondsLeft % 60;
            timerDiv.innerText = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
            secondsLeft--;
          }
          
          updateTimer();
          setInterval(updateTimer, 1000);
        </script>
      </div>
    `);
  }

  if (!req.file) return res.redirect('/');
  
  // Конвертация файла в Base64 для моментального отображения
  const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  
  const newPost = {
    id: Date.now(),
    title: req.body.title || 'Без названия',
    author: req.body.author || 'Аноним',
    image: base64Image,
    likes: 0,
    adminLikes: 0,
    likedBy: [],
    adminLikedBy: [],
    isAdminPost: isAdmin // Помечаем, админский ли это пост
  };
  
  posts.push(newPost);
  
  // Для админов время публикации не забиваем в лимиты флуда
  if (!isAdmin) {
    lastPostTime[userIp] = now;
  }
  
  res.redirect('/');
});

// Проверка админ-пароля
app.post('/auth-admin', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Обработка обычных лайков (1 раз с 1 IP)
app.post('/like/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const post = posts.find(p => p.id === postId);
  
  if (!post) return res.json({ success: false, message: 'Пост не найден' });
  
  if (post.likedBy.includes(userIp)) {
    return res.json({ success: false, message: 'Вы уже лайкнули этот арт!' });
  }
  
  post.likes += 1;
  post.likedBy.push(userIp); 
  res.json({ success: true, likes: post.likes });
});

// Обработка админ-лайков (1 раз на пост)
app.post('/admin-like/:id', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.json({ success: false, message: 'Неверный пароль администратора!' });
  }

  const postId = parseInt(req.params.id);
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const post = posts.find(p => p.id === postId);
  
  if (!post) return res.json({ success: false, message: 'Пост не найден' });
  
  if (post.adminLikedBy.includes(userIp)) {
    return res.json({ success: false, message: 'Вы уже поставили админ-лайк этому арту!' });
  }

  post.adminLikes += 1;
  post.adminLikedBy.push(userIp);
  res.json({ success: true, adminLikes: post.adminLikes });
});

// Обработка удаления поста (Только для админа)
app.post('/delete/:id', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.json({ success: false, message: 'Неверный пароль администратора!' });
  }

  const postId = parseInt(req.params.id);
  const initialLength = posts.length;
  posts = posts.filter(p => p.id !== postId);
  
  if (posts.length < initialLength) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Пост не найден или уже удален' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});


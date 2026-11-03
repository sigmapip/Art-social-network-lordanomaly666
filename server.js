const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// База данных в памяти сервера
let posts = [
  {
    id: 1,
    title: "Демонстрационный арт",
    author: "Система",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://w3.org' width='100' height='100' viewBox='0 0 100 100'><rect width='100' stroke='%23ccc' stroke-width='2' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%23666'>Здесь будет ваш арт</text></svg>",
    likes: 5,
    adminLikes: 0,
    likedBy: [],      // Список IP, кто уже поставил обычный лайк
    adminLikedBy: []  // Список IP, кто уже поставил админ-лайк
  }
];

// База для защиты от спама: хранит IP и время последнего поста
const lastPostTime = {}; 
const ADMIN_PASSWORD = "90684e3";
const FLOOD_LIMIT_MS = 5 * 60 * 1000; // 5 минут в миллисекундах

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  // Получаем IP пользователя для проверки ограничений
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Умная сортировка: сначала арты с админ-лайками (💙), затем по дате (новые выше)
  const sortedPosts = [...posts].sort((a, b) => {
    if (b.adminLikes !== a.adminLikes) {
      return b.adminLikes - a.adminLikes; // У кого больше 💙, тот выше
    }
    return b.id - a.id; // При равенстве 💙 — новые сверху
  });

  let postsHtml = sortedPosts.map(post => {
    return `
    <div class="post" id="post-${post.id}">
      <img src="${post.image}" alt="${post.title}">
      <div class="post-info">
        <h3>${post.title}</h3>
        <p>Автор: <strong>${post.author}</strong></p>
        <div class="post-actions">
          <button class="btn-like" onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${post.likes}</span></button>
          
          <!-- Админ-лайки видны всем, но нажимать их без пароля нельзя -->
          <span class="admin-heart-display">💙 <span id="admin-like-count-${post.id}">${post.adminLikes}</span></span>
          
          <!-- Эти кнопки будут скрыты/показаны через JS в зависимости от пароля -->
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
        
        /* Панель авторизации админа */
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
        .post-info p { margin: 0 0 15px 0; color: #777; }
        
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
        
        <!-- Вход для админа -->
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

        <form action="/upload" method="POST" enctype="multipart/form-data">
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
        // При загрузке страницы проверяем, залогинен ли админ
        window.onload = function() {
          if (localStorage.getItem('isAdmin') === 'true') {
            showAdminFeatures();
          }
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
              localStorage.setItem('adminPassword', pass); // сохраняем ключ для отправки запросов
              showAdminFeatures();
            } else {
              alert('Неверный пароль администратора!');
            }
          });
        }

        function showAdminFeatures() {
          document.getElementById('auth-input-zone').style.display = 'none';
          document.getElementById('auth-success-zone').style.display = 'block';
          
          // Показываем все скрытые админские кнопки
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
              // Перезагружаем страницу, чтобы сработала сортировка и арт улетел вверх
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

// Обработка загрузки нового поста (с защитой от спама)
app.post('/upload', upload.single('artImage'), (req, res) => {
const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  // Умная сортировка: сначала арты с админ-лайками (💙), затем по дате (новые выше)
  const sortedPosts = [...posts].sort((a, b) => {
    if (b.adminLikes !== a.adminLikes) {
      return b.adminLikes - a.adminLikes; // У кого больше 💙, тот выше
    }
    return b.id - a.id; // При равенстве 💙 — новые сверху
  });

  let postsHtml = sortedPosts.map(post => {
    return `
    <div class="post" id="post-${post.id}">
      <img src="${post.image}" alt="${post.title}">
      <div class="post-info">
        <h3>${post.title}</h3>
        <p>Автор: <strong>${post.author}</strong></p>
        <div class="post-actions">
          <button class="btn-like" onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${post.likes}</span></button>
          
          <!-- Админ-лайки видны всем, но нажимать их без пароля нельзя -->
          <span class="admin-heart-display">💙 <span id="admin-like-count-${post.id}">${post.adminLikes}</span></span>
          
          <!-- Эти кнопки будут скрыты/показаны через JS в зависимости от пароля -->
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
        
        /* Панель авторизации админа */
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
        .post-info p { margin: 0 0 15px 0; color: #777; }
        
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
        
        <!-- Вход для админа -->
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

        <form action="/upload" method="POST" enctype="multipart/form-data">
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
        // При загрузке страницы проверяем, залогинен ли админ
        window.onload = function() {
          if (localStorage.getItem('isAdmin') === 'true') {
            showAdminFeatures();
          }
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
              localStorage.setItem('adminPassword', pass); // сохраняем ключ для отправки запросов
              showAdminFeatures();
            } else {
              alert('Неверный пароль администратора!');
            }
          });
        }

        function showAdminFeatures() {
          document.getElementById('auth-input-zone').style.display = 'none';
          document.getElementById('auth-success-zone').style.display = 'block';
          
          // Показываем все скрытые админские кнопки
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
              // Перезагружаем страницу, чтобы сработала сортировка и арт улетел вверх
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

// Обработка загрузки нового поста (с защитой от спама)
app.post('/upload', upload.single('artImage'), (req, res) => {
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();

  // Проверка анти-флуда (5 минут)
  if (lastPostTime[userIp] && (now - lastPostTime[userIp] < FLOOD_LIMIT_MS)) {
    const timeLeftMs = FLOOD_LIMIT_MS - (now - lastPostTime[userIp]);
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = ((timeLeftMs % 60000) / 1000).toFixed(0);
    
    return res.send(`
      <div style="text-align:center; padding:50px; font-family:sans-serif;">
        <h2>🛑 Слишком часто!</h2>
        <p>Вы можете выкладывать арты только раз в 5 минут, чтобы избежать спама.</p>
        <p>Пожалуйста, подождите еще <strong>${minutes} мин. ${seconds} сек.</strong></p>
        <br><a href="/">Вернуться назад</a>
      </div>
    `);
  }

  if (!req.file) return res.redirect('/');
  
  const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  
  const newPost = {
    id: Date.now(),
    title: req.body.title || 'Без названия',
    author: req.body.author || 'Аноним',
    image: base64Image,
    likes: 0,
    adminLikes: 0,
    likedBy: [],
    adminLikedBy: []
  };
  
  posts.push(newPost);
  lastPostTime[userIp] = now; // Запоминаем время публикации для этого IP
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

// Обработка обычных лайков (не более 1 раза с одного IP)
app.post('/like/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const post = posts.find(p => p.id === postId);
  
  if (!post) return res.json({ success: false, message: 'Пост не найден' });
  
  if (post.likedBy.includes(userIp)) {
    return res.json({ success: false, message: 'Вы уже лайкнули этот арт!' });
  }
  
  post.likes += 1;
  post.likedBy.push(userIp); // Записываем IP, чтобы исключить повторный лайк
  res.json({ success: true, likes: post.likes });
});

// Обработка админских лайков (Только для админа, 1 раз на пост)
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



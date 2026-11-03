const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Настройка сохранения картинок (сохраняем прямо в оперативную память для простоты)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Наша временная база данных в памяти сервера
let posts = [
  {
    id: 1,
    title: "Мой первый thematic-арт!",
    author: "Админ",
    image: "data:image/svg+xml;utf8,<svg xmlns='http://w3.org' width='100' height='100' viewBox='0 0 100 100'><rect width='100' stroke='%23ccc' stroke-width='2' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%23666'>Здесь будет арт</text></svg>",
    likes: 5
  }
];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Главная страница: собираем HTML-интерфейс
app.get('/', (req, res) => {
  let postsHtml = posts.map(post => `
    <div class="post" id="post-${post.id}">
      <img src="${post.image}" alt="${post.title}">
      <div class="post-info">
        <h3>${post.title}</h3>
        <p>Автор: <strong>${post.author}</strong></p>
        <div class="post-actions">
          <button class="btn-like" onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${post.likes}</span></button>
          <button class="btn-delete" onclick="deletePost(${post.id})">🗑️ Удалить</button>
        </div>
      </div>
    </div>
  `).reverse().join('');

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
        header { text-align: center; margin-bottom: 30px; }
        form { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 30px; }
        input, button, textarea { width: 100%; padding: 10px; margin: 5px 0 15px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        .btn-submit { background: #0095f6; color: white; border: none; font-weight: bold; cursor: pointer; }
        .post { background: white; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 25px; overflow: hidden; }
        .post img { width: 100%; display: block; max-height: 500px; object-fit: contain; background: #f0f0f0; }
        .post-info { padding: 15px; }
        .post-info h3 { margin: 0 0 5px 0; }
        .post-info p { margin: 0 0 15px 0; color: #777; }
        .post-actions { display: flex; gap: 10px; }
        .btn-like { width: auto; background: #eee; color: #333; padding: 5px 15px; border: none; border-radius: 5px; cursor: pointer; }
        .btn-delete { width: auto; background: #ffebeb; color: #ff4d4d; padding: 5px 15px; border: 1px solid #ffccd0; border-radius: 5px; cursor: pointer; }
        .btn-delete:hover { background: #ff4d4d; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
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
        function likePost(id) {
          fetch('/like/' + id, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              if(data.success) {
                document.getElementById('like-count-' + id).innerText = data.likes;
              }
            });
        }

        function deletePost(id) {
          if (confirm('Точно удалить этот арт?')) {
            fetch('/delete/' + id, { method: 'POST' })
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  // Перезагружаем страницу, чтобы обновленная лента загрузилась с сервера
                  location.reload();
                } else {
                  alert('Ошибка при удалении поста');
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
  if (!req.file) return res.redirect('/');
  
  // Конвертируем загруженный файл в строку base64
  const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  
  const newPost = {
    id: Date.now(), // Используем метку времени для уникальности id
    title: req.body.title || 'Без названия',
    author: req.body.author || 'Аноним',
    image: base64Image,
    likes: 0
  };
  
  posts.push(newPost);
  res.redirect('/');
});

// Обработка лайков через API
app.post('/like/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.likes += 1;
    return res.json({ success: true, likes: post.likes });
  }
  res.json({ success: false });
});

// Обработка удаления поста через API
app.post('/delete/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  const initialLength = posts.length;
  // Оставляем только те посты, id которых НЕ равен удаляемому
  posts = posts.filter(p => p.id !== postId);
  
  if (posts.length < initialLength) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

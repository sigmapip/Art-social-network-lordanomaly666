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
    title: "Мой первый тематический арт!",
    author: "Админ",
    // Демо-картинка (заглушка)
    image: "data:image/svg+xml;utf8,<svg xmlns='http://w3.org' width='100' height='100' viewBox='0 0 100 100'><rect width='100' stroke='%23ccc' stroke-width='2' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%23666'>Здесь будет арт</text></svg>",
    likes: 5
  }
];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Главная страница: собираем HTML-интерфейс
app.get('/', (req, res) => {
  let postsHtml = posts.map(post => `
    <div class="post">
      <img src="${post.image}" alt="${post.title}">
      <div class="post-info">
        <h3>${post.title}</h3>
        <p>Автор: <strong>${post.author}</strong></p>
        <button onclick="likePost(${post.id})">❤️ <span id="like-count-${post.id}">${post.likes}</span></button>
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
        button { background: #0095f6; color: white; border: none; font-weight: bold; cursor: pointer; }
        .post { background: white; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 25px; overflow: hidden; }
        .post img { width: 100%; display: block; max-height: 500px; object-fit: contain; background: #f0f0f0; }
        .post-info { padding: 15px; }
        .post-info h3 { margin: 0 0 5px 0; }
        .post-info p { margin: 0 0 15px 0; color: #777; }
        .post-info button { width: auto; background: #eee; color: #333; padding: 5px 15px; }
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
          
          <button type="submit">Опубликовать в ленту</button>
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
      </script>
    </body>
    </html>
  `);
});

// Обработка загрузки нового поста
app.post('/upload', upload.single('artImage'), (req, res) => {
  if (!req.file) return res.redirect('/');
  
  // Конвертируем загруженный файл в строку base64, чтобы отобразить без сохранения на диск
  const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  
  const newPost = {
    id: posts.length + 1,
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

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

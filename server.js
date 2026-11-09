const express = require('express');
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

// Обработка загрузки на сервере
app.post('/upload', upload.single('artImage'), (req, res) => {
  if (!req.file) return res.redirect('/');
  
  const isAdmin = req.body.adminPassword === ADMIN_PASSWORD;
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
    isAdminPost: isAdmin
  };
  
  posts.push(newPost);
  res.redirect('/');
});

app.post('/auth-admin', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

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

app.post('/delete/:id', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.json({ success: false, message: 'Неверный пароль администратора!' });
  }

  const postId = parseInt(req.params.id);
  posts = posts.filter(p => p.id !== postId);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту 
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

// Обработка загрузки постов с отправкой файла на ImgBB и записью в PostgreSQL
app.post('/upload', upload.single('artImage'), async (req, res) => {
  if (!req.file) return res.redirect('/');
  
  try {
    const isAdmin = req.body.adminPassword === ADMIN_PASSWORD;
    
    // Переводим файл в base64 формат, необходимый для ImgBB API
    const base64File = req.file.buffer.toString('base64');
    
    // Формируем запрос к API ImgBB
    const formData = new URLSearchParams();
    formData.append('image', base64File);

    const imgbbRes = await axios.post(`https://imgbb.com{process.env.IMGBB_API_KEY}`, formData);
    
    // Получаем прямую надежную ссылку на сохраненную картинку
    const imageUrl = imgbbRes.data.data.url;

    const postId = Date.now();
    const title = req.body.title || 'Без названия';
    const author = req.body.author || 'Аноним';

    // Сохраняем все данные в вашу базу PostgreSQL
    await client.query(
      `INSERT INTO posts (id, title, author, image, likes, admin_likes, liked_by, admin_liked_by, is_admin_post) 
       VALUES ($1, $2, $3, $4, 0, 0, '[]', '[]', $5)`,
      [postId, title, author, imageUrl, isAdmin]
    );

    res.redirect('/');
  } catch (err) {
    console.error('Ошибка публикации:', err);
    res.status(500).send('Не удалось выложить арт. Проверьте логи на Render. Ошибка: ' + err.message);
  }
});

app.post('/auth-admin', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Роут обычных лайков с сохранением в БД
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

// Роут админских лайков с сохранением в БД
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

// Удаление постов из базы данных
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
 

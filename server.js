const express = require('express');
const multer = require('multer');
const { Client } = require('pg');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const ADMIN_PASSWORD = "90684e3";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => client.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGINT PRIMARY KEY, title TEXT, author TEXT, image TEXT,
      likes INT DEFAULT 0, admin_likes INT DEFAULT 0,
      liked_by TEXT DEFAULT '[]', admin_liked_by TEXT DEFAULT '[]', is_admin_post BOOLEAN DEFAULT false
    );
  `))
  .catch(err => console.error('DB Error:', err));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    const dbRes = await client.query('SELECT * FROM posts ORDER BY admin_likes DESC, id DESC');
    let postsHtml = dbRes.rows.map(post => `
      <div class="post">
        <img src="${post.image}">
        <div class="post-info">
          <h3>${post.title}</h3>
          <p>Автор: <strong>${post.author}</strong> ${post.is_admin_post ? '<span class="badge">✔️ Администратор</span>' : ''}</p>
          <div class="actions">
            <button onclick="like(${post.id})">❤️ <span id="l-${post.id}">${post.likes || 0}</span></button>
            <span class="a-heart">💙 <span id="al-${post.id}">${post.admin_likes || 0}</span></span>
            <button class="admin-only" onclick="adminLike(${post.id})" style="display:none; background:#1d9bf0; color:white;">💙 Поставить</button>
            <button class="admin-only" onclick="del(${post.id})" style="display:none; background:#ffebeb; color:#ff4d4d;">🗑️ Удалить</button>
          </div>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Арт-Соцсеть</title>
        <style>
          body { font-family: sans-serif; background: #fafafa; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .auth-bar { background: #333; color: white; padding: 10px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 10px; }
          .auth-bar input { flex-grow: 1; padding: 5px; border-radius: 4px; border: none; }
          form { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 30px; }
          input, button { width: 100%; padding: 10px; margin: 5px 0 15px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
          .btn-sub { background: #0095f6; color: white; border: none; font-weight: bold; cursor: pointer; }
          .post { background: white; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 25px; overflow: hidden; }
          .post img { width: 100%; max-height: 500px; object-fit: contain; background: #f0f0f0; }
          .post-info { padding: 15px; }
          .actions { display: flex; gap: 10px; align-items: center; }
          .actions button { width: auto; margin: 0; padding: 6px 12px; cursor: pointer; }
          .a-heart { background: #e8f4fd; color: #1d9bf0; padding: 6px 12px; border-radius: 5px; font-weight: bold; }
          .badge { background: #1d9bf0; color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; }
          .t-screen { display: none; text-align: center; padding: 50px 20px; background: white; border-radius: 10px; }
        </style>
      </head>
      <body>
        <div class="container" id="main">
          <div class="auth-bar" id="auth-zone">
            <input type="password" id="p-input" placeholder="Пароль админа...">
            <button onclick="login()" style="width:auto; margin:0; padding:5px 15px;">Войти</button>
          </div>
          <div class="auth-bar" id="auth-ok" style="display:none; color:#ffdd57; font-weight:bold;">⚡ Режим Администратора</div>
          <header style="text-align:center; margin-bottom:20px;"><h1>🎨 Наша Арт Соцсеть</h1></header>
          <form action="/upload" method="POST" enctype="multipart/form-data" onsubmit="return checkFlood(this)">
            <input type="hidden" name="adminPassword" id="f-pass">
            <input type="text" name="title" required placeholder="Название арта">
            <input type="text" name="author" required placeholder="Ваш никнейм">
            <input type="file" name="artImage" accept="image/*" required>
            <button type="submit" class="btn-sub">Опубликовать</button>
          </form>
          <div id="feed">${postsHtml || '<p style="text-align:center; color:#999;">Лента пока пуста.</p>'}</div>
        </div>
        <div class="container t-screen" id="t-zone">
          <h2>🛑 Анти-спам лимит</h2><p>Публиковать арты можно раз в 5 минут.</p>
          <div style="font-size:48px; font-weight:bold; color:#ff4d4d; margin:20px;" id="timer">05:00</div>
          <button onclick="document.getElementById('t-zone').style.display='none'; document.getElementById('main').style.display='block';" style="background:#0095f6; color:white; width:auto; padding:10px 20px;">Назад</button>
        </div>
        <script>
          window.onload = () => { if(localStorage.getItem('isAdmin')==='true') showAdmin(); }
          function login() {
            const pass = document.getElementById('p-input').value;
            fetch('/auth-admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pass}) })
              .then(res => res.json()).then(data => {
                if(data.success) { localStorage.setItem('isAdmin','true'); localStorage.setItem('adminPassword',pass); showAdmin(); location.reload(); }
                else alert('Неверный пароль!');
              });
          }
          function showAdmin() {
            document.getElementById('auth-zone').style.display='none'; document.getElementById('auth-ok').style.display='block';
            document.querySelectorAll('.admin-only').forEach(b => b.style.display='inline-block');
          }
          function checkFlood() {
            document.getElementById('f-pass').value = localStorage.getItem('adminPassword') || '';
            if(localStorage.getItem('isAdmin')==='true') return true;
            const last = localStorage.getItem('lastPost'); const now = Date.now();
            if(last && (now - last < 300000)) { startTimer(Math.ceil((300000 - (now - last)) / 1000)); return false; }
            localStorage.setItem('lastPost', now); return true;
          }
          function startTimer(sec) {
            document.getElementById('main').style.display='none'; document.getElementById('t-zone').style.display='block';
            let left = sec;
            const iv = setInterval(() => {
              if(left <= 0) { clearInterval(iv); document.getElementById('t-zone').style.display='none'; document.getElementById('main').style.display='block'; return; }
              let m = Math.floor(left / 60); let s = left % 60;
              document.getElementById('timer').innerText = (m<10?'0':'')+m+':'+(s<10?'0':'')+s; left--;
            }, 1000);
          }
          function like(id) { fetch('/like/'+id, {method:'POST'}).then(r=>r.json()).then(d=>{if(d.success) document.getElementById('l-'+id).innerText=d.likes; else alert(d.message);}); }
          function adminLike(id) { fetch('/admin-like/'+id, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:localStorage.getItem('adminPassword')})}).then(r=>r.json()).then(d=>{if(d.success) location.reload(); else alert(d.message);}); }
          function del(id) { if(confirm('Удалить?')) fetch('/delete/'+id, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:localStorage.getItem('adminPassword')})}).then(r=>r.json()).then(d=>{if(d.success) location.reload();}); }
        </script>
      </body>
      </html>
    `);
  } catch (err) { res.status(500).send('Ошибка: ' + err.message); }
});

app.post('/upload', upload.single('artImage'), async (req, res) => {
  if (!req.file) return res.redirect('/');
  try {
    const isAdmin = req.body.adminPassword === ADMIN_PASSWORD;
    const formData = new URLSearchParams(); formData.append('image', req.file.buffer.toString('base64'));
    const imgbbRes = await axios.post(`https://imgbb.com{process.env.IMGBB_API_KEY}`, formData);
    await client.query(
      `INSERT INTO posts (id, title, author, image, likes, admin_likes, liked_by, admin_liked_by, is_admin_post) VALUES ($1, $2, $3, $4, 0, 0, '[]', '[]', $5)`,
      [Date.now(), req.body.title||'Без названия', req.body.author||'Аноним', imgbbRes.data.data.url, isAdmin]
    );
    res.redirect('/');
  } catch (err) { res.status(500).send('Ошибка публикации: ' + err.message); }
});

app.post('/auth-admin', (req, res) => res.json({ success: req.body.password === ADMIN_PASSWORD }));

app.post('/like/:id', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'; const postRes = await client.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if(postRes.rows.length===0) return res.json({success:false, message:'Не найден'});
    let post = postRes.rows[0]; let liked = JSON.parse(post.liked_by || '[]');
    if(liked.includes(ip)) return res.json({success:false, message:'Вы уже голосовали!'});
    liked.push(ip); const nl = (post.likes || 0) + 1;
    await client.query('UPDATE posts SET likes = $1, liked_by = $2 WHERE id = $3', [nl, JSON.stringify(liked), req.params.id]);
    res.json({ success: true, likes: nl });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

app.post('/admin-like/:id', async (req, res) => {
  try {
        if (req.body.password !== ADMIN_PASSWORD) return res.json({ success: false, message: 'Запрещено' });
    const ip = req.ip || 'unknown'; const postRes = await client.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if(postRes.rows.length===0) return res.json({success:false, message:'Не найден'});
    let post = postRes.rows[0]; let aliked = JSON.parse(post.admin_liked_by || '[]');
    if(aliked.includes(ip)) return res.json({success:false, message:'Админ уже голосовал!'});
    aliked.push(ip); const nal = (post.admin_likes || 0) + 1;
    await client.query('UPDATE posts SET admin_likes = $1, admin_liked_by = $2 WHERE id = $3', [nal, JSON.stringify(aliked), req.params.id]);
    res.json({ success: true, adminLikes: nal });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

app.post('/delete/:id', async (req, res) => {
  try {
    if (req.body.password !== ADMIN_PASSWORD) return res.json({ success: false, message: 'Запрещено' });
    await client.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

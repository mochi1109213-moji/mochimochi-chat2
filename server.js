const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect();

// テーブルをアップデート（nameとtimeを追加）
client.query('DROP TABLE IF EXISTS messages'); // 古いテーブルを消す命令
client.query('CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name TEXT, content TEXT, time TEXT)');
app.use(express.static('public'));

io.on('connection', async (socket) => {
  // 過去ログ取得
  const res = await client.query('SELECT name, content, time FROM messages ORDER BY id ASC');
  res.rows.forEach(row => {
    socket.emit('chat message', { name: row.name, message: row.content, time: row.time });
  });

  socket.on('chat message', async (data) => {
    // DB保存
    await client.query('INSERT INTO messages (name, content, time) VALUES ($1, $2, $3)', [data.name, data.message, data.time]);
    io.emit('chat message', data);
  });
});

http.listen(process.env.PORT || 3000);

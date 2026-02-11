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

// テーブル作成（名前、内容、時間を保存できるようにする）
client.query('CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name TEXT, content TEXT, time TEXT)');

// 【重要】HTMLファイルが入っているフォルダを指定する
app.use(express.static('public'));

io.on('connection', async (socket) => {
  // 過去のメッセージをDBから読み込んで表示する
  const res = await client.query('SELECT name, content, time FROM messages ORDER BY id ASC');
  res.rows.forEach(row => {
    socket.emit('chat message', { name: row.name, message: row.content, time: row.time });
  });

  socket.on('chat message', async (data) => {
    // 送信されたメッセージをDBに保存する
    await client.query('INSERT INTO messages (name, content, time) VALUES ($1, $2, $3)', [data.name, data.message, data.time]);
    // 全員にメッセージを送る
    io.emit('chat message', data);
  });
});

// ポート設定
http.listen(process.env.PORT || 3000);

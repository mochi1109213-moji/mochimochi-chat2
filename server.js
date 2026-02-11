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

// データベースの初期設定（既読テーブルとリアクション列を追加）
async function initDB() {
  await client.query('DROP TABLE IF EXISTS reads'); // 一旦消す
  await client.query('DROP TABLE IF EXISTS messages'); // 一旦消す
  await client.query('CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name TEXT, content TEXT, time TEXT, reaction TEXT)');
  await client.query('CREATE TABLE IF NOT EXISTS reads (message_id INTEGER, user_name TEXT, PRIMARY KEY (message_id, user_name))');
}
initDB();

app.use(express.static('public'));

io.on('connection', async (socket) => {
  // 過去ログ取得（既読数と既読者の名前を合体させて取得する高度な命令）
  const res = await client.query(`
    SELECT m.*, 
    (SELECT COUNT(*) FROM reads WHERE message_id = m.id) as read_count,
    (SELECT string_agg(user_name, ', ') FROM reads WHERE message_id = m.id) as readers
    FROM messages m ORDER BY m.id ASC
  `);
  
  res.rows.forEach(row => {
    socket.emit('chat message', { 
      id: row.id, name: row.name, message: row.content, 
      time: row.time, reaction: row.reaction,
      readCount: parseInt(row.read_count), readers: row.readers 
    });
  });

  // メッセージ送信
  socket.on('chat message', async (data) => {
    const result = await client.query(
      'INSERT INTO messages (name, content, time) VALUES ($1, $2, $3) RETURNING id', 
      [data.name, data.message, data.time]
    );
    data.id = result.rows[0].id;
    data.readCount = 0;
    io.emit('chat message', data);
  });

  // 既読をつける
  socket.on('mark as read', async (data) => {
    await client.query('INSERT INTO reads (message_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [data.id, data.userName]);
    const result = await client.query('SELECT COUNT(*) as count, string_agg(user_name, \', \') as names FROM reads WHERE message_id = $1', [data.id]);
    io.emit('update read', { id: data.id, count: result.rows[0].count, readers: result.rows[0].names });
  });

  // リアクション（👍）
  socket.on('reaction', async (data) => {
    await client.query('UPDATE messages SET reaction = $1 WHERE id = $2', [data.emoji, data.id]);
    io.emit('update reaction', data);
  });

  // 送信取り消し（削除）
  socket.on('delete message', async (id) => {
    await client.query('DELETE FROM reads WHERE message_id = $1', [id]); // 既読データも消す
    await client.query('DELETE FROM messages WHERE id = $1', [id]);
    io.emit('delete message', id);
  });
});

http.listen(process.env.PORT || 3000);

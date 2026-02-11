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
client.query('CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, content TEXT)');

app.use(express.static('public'));

io.on('connection', async (socket) => {
  const res = await client.query('SELECT content FROM messages ORDER BY id ASC');
  res.rows.forEach(row => {
    socket.emit('chat message', row.content);
  });
  socket.on('chat message', async (msg) => {
    await client.query('INSERT INTO messages (content) VALUES ($1)', [msg]);
    io.emit('chat message', msg);
  });
});

http.listen(process.env.PORT || 3000);

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const PORT = process.env.PORT || 3000;

// publicフォルダのファイルを読み込めるようにする
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('ユーザーが参加しました');

  // メッセージを受信して全員に送る
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
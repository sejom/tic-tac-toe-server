const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const rooms = {};

io.on('connection', (socket) => {

  socket.on('createRoom', (roomCode) => {
    rooms[roomCode] = { board: Array(9).fill(''), currentPlayer: 'X' };
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', (roomCode) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      socket.emit('roomJoined', roomCode);
      io.to(roomCode).emit('gameStart', rooms[roomCode]);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('makeMove', ({ roomCode, index }) => {
    const room = rooms[roomCode];
    if (!room || room.board[index]) return;

    room.board[index] = room.currentPlayer;
    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';

    io.to(roomCode).emit('moveMade', { board: room.board, currentPlayer: room.currentPlayer });

    const winner = checkWinner(room.board);
    if (winner) {
      io.to(roomCode).emit('gameOver', { winner });
      delete rooms[roomCode];
    } else if (room.board.every(cell => cell)) {
      io.to(roomCode).emit('gameOver', { winner: 'draw' });
      delete rooms[roomCode];
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

});

function checkWinner(board) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let [a,b,c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

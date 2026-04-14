const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const rooms = {};

function checkTicTacToeWinner(board) {
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

function checkConnectFourWinner(board) {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (c + 3 < 7 && p === board[r][c+1] && p === board[r][c+2] && p === board[r][c+3]) return p;
      if (r + 3 < 6 && p === board[r+1][c] && p === board[r+2][c] && p === board[r+3][c]) return p;
      if (r + 3 < 6 && c + 3 < 7 && p === board[r+1][c+1] && p === board[r+2][c+2] && p === board[r+3][c+3]) return p;
      if (r + 3 < 6 && c - 3 >= 0 && p === board[r+1][c-1] && p === board[r+2][c-2] && p === board[r+3][c-3]) return p;
    }
  }
  return null;
}

io.on('connection', (socket) => {

  // --- Tic Tac Toe ---
  socket.on('createRoom', (roomCode) => {
    rooms[roomCode] = { type: 'ttt', board: Array(9).fill(''), currentPlayer: 'X' };
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
    const winner = checkTicTacToeWinner(room.board);
    if (winner) {
      io.to(roomCode).emit('gameOver', { winner });
      delete rooms[roomCode];
    } else if (room.board.every(cell => cell)) {
      io.to(roomCode).emit('gameOver', { winner: 'draw' });
      delete rooms[roomCode];
    }
  });

  // --- Connect Four ---
  socket.on('createConnectFourRoom', (roomCode) => {
    rooms[roomCode] = {
      type: 'c4',
      board: Array(6).fill(null).map(() => Array(7).fill('')),
      currentPlayer: '1'
    };
    socket.join(roomCode);
    socket.emit('connectFourRoomCreated', roomCode);
  });

  socket.on('joinConnectFourRoom', (roomCode) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      socket.emit('connectFourRoomJoined', roomCode);
      io.to(roomCode).emit('connectFourStart', rooms[roomCode]);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('connectFourMove', ({ roomCode, col }) => {
    const room = rooms[roomCode];
    if (!room) return;
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (!room.board[r][col]) { row = r; break; }
    }
    if (row === -1) return;
    room.board[row][col] = room.currentPlayer;
    room.currentPlayer = room.currentPlayer === '1' ? '2' : '1';
    io.to(roomCode).emit('connectFourMoveMade', { board: room.board, currentPlayer: room.currentPlayer });
    const winner = checkConnectFourWinner(room.board);
    if (winner) {
      io.to(roomCode).emit('connectFourGameOver', { winner });
      delete rooms[roomCode];
    } else if (room.board.every(row => row.every(cell => cell))) {
      io.to(roomCode).emit('connectFourGameOver', { winner: 'draw' });
      delete rooms[roomCode];
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

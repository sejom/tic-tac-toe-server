const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const rooms = {};

const WORDS = ['apple','banana','cat','dog','elephant','fish','guitar','house','island','jacket','kangaroo','lion','mountain','notebook','ocean','piano','queen','robot','sunset','tiger','umbrella','violin','waterfall','xylophone','zebra'];

function checkTicTacToeWinner(board) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
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
      if (c+3<7 && p===board[r][c+1] && p===board[r][c+2] && p===board[r][c+3]) return p;
      if (r+3<6 && p===board[r+1][c] && p===board[r+2][c] && p===board[r+3][c]) return p;
      if (r+3<6 && c+3<7 && p===board[r+1][c+1] && p===board[r+2][c+2] && p===board[r+3][c+3]) return p;
      if (r+3<6 && c-3>=0 && p===board[r+1][c-1] && p===board[r+2][c-2] && p===board[r+3][c-3]) return p;
    }
  }
  return null;
}

const MORRIS_ADJACENCY = [
  [1,9],[0,2,4],[1,14],[4,10],[3,5,1,7],[4,13],[7,11],[6,8,4],[7,12],
  [0,10,21],[9,11,3],[10,12,6],[11,8,13],[12,5,14],[13,2,7],
  [16,11],[15,17,19],[16,12],[10,19,3],[18,20,16],[19,13],[9,22],[21,23,18],[22,14]
];

const MORRIS_MILLS = [
  [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
  [0,9,21],[3,10,18],[6,11,15],[1,4,7],[22,19,16],[23,20,17],[2,14,23],[5,13,20],[8,12,17]
];

function checkMill(board, idx, player) {
  return MORRIS_MILLS.some(mill => mill.includes(idx) && mill.every(i => board[i] === player));
}

function isInAnyMill(board, idx) {
  return MORRIS_MILLS.some(mill => mill.includes(idx) && mill.every(i => board[i] !== ''));
}

function countPieces(board, player) {
  return board.filter(p => p === player).length;
}

function allInMills(board, player) {
  return board.every((p, i) => p !== player || isInAnyMill(board, i));
}

const CHESS_INIT = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR']
];

function isValidChessMove(board, from, to, player) {
  const [fr,fc] = from;
  const [tr,tc] = to;
  const piece = board[fr][fc];
  if (!piece||piece[0]!==player) return false;
  const target = board[tr][tc];
  if (target&&target[0]===player) return false;
  const type = piece[1];
  const enemy = player==='w'?'b':'w';
  const dir = player==='w'?-1:1;

  function inBounds(r,c){return r>=0&&r<8&&c>=0&&c<8;}
  function slide(dr,dc){
    let r=fr+dr,c=fc+dc;
    while(inBounds(r,c)){
      if(r===tr&&c===tc) return true;
      if(board[r][c]) return false;
      r+=dr;c+=dc;
    }
    return false;
  }

  if(type==='P'){
    if(fc===tc&&tr===fr+dir&&!board[tr][tc]) return true;
    if(fc===tc&&tr===fr+2*dir&&((player==='w'&&fr===6)||(player==='b'&&fr===1))&&!board[fr+dir][fc]&&!board[tr][tc]) return true;
    if(Math.abs(tc-fc)===1&&tr===fr+dir&&target&&target[0]===enemy) return true;
    return false;
  }
  if(type==='R') return (fr===tr||fc===tc)&&slide(Math.sign(tr-fr),Math.sign(tc-fc));
  if(type==='B') return Math.abs(tr-fr)===Math.abs(tc-fc)&&slide(Math.sign(tr-fr),Math.sign(tc-fc));
  if(type==='Q') return (fr===tr||fc===tc||Math.abs(tr-fr)===Math.abs(tc-fc))&&slide(Math.sign(tr-fr),Math.sign(tc-fc));
  if(type==='N'){const dr=Math.abs(tr-fr),dc=Math.abs(tc-fc);return(dr===2&&dc===1)||(dr===1&&dc===2);}
  if(type==='K') return Math.abs(tr-fr)<=1&&Math.abs(tc-fc)<=1;
  return false;
}

function isKingInCheck(board, player) {
  let kr=-1,kc=-1;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===player+'K'){kr=r;kc=c;}
  if(kr===-1) return true;
  const enemy=player==='w'?'b':'w';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    if(board[r][c]&&board[r][c][0]===enemy){
      if(isValidChessMove(board,[r,c],[kr,kc],enemy)) return true;
    }
  }
  return false;
}

function hasAnyValidMove(board, player) {
  for(let fr=0;fr<8;fr++) for(let fc=0;fc<8;fc++){
    if(!board[fr][fc]||board[fr][fc][0]!==player) continue;
    for(let tr=0;tr<8;tr++) for(let tc=0;tc<8;tc++){
      if(isValidChessMove(board,[fr,fc],[tr,tc],player)){
        const newBoard=board.map(r=>[...r]);
        newBoard[tr][tc]=newBoard[fr][fc];
        newBoard[fr][fc]=null;
        if(!isKingInCheck(newBoard,player)) return true;
      }
    }
  }
  return false;
}

io.on('connection', (socket) => {

  // --- Tic Tac Toe ---
  socket.on('createRoom', (roomCode) => {
    rooms[roomCode]={type:'ttt',board:Array(9).fill(''),currentPlayer:'X'};
    socket.join(roomCode);
    socket.emit('roomCreated',roomCode);
  });

  socket.on('joinRoom', (roomCode) => {
    if(rooms[roomCode]){
      socket.join(roomCode);
      socket.emit('roomJoined',roomCode);
      io.to(roomCode).emit('gameStart',rooms[roomCode]);
    } else socket.emit('error','Room not found');
  });

  socket.on('makeMove', ({roomCode,index}) => {
    const room=rooms[roomCode];
    if(!room||room.board[index]) return;
    room.board[index]=room.currentPlayer;
    room.currentPlayer=room.currentPlayer==='X'?'O':'X';
    io.to(roomCode).emit('moveMade',{board:room.board,currentPlayer:room.currentPlayer});
    const winner=checkTicTacToeWinner(room.board);
    if(winner){io.to(roomCode).emit('gameOver',{winner});delete rooms[roomCode];}
    else if(room.board.every(c=>c)){io.to(roomCode).emit('gameOver',{winner:'draw'});delete rooms[roomCode];}
  });

  // --- Connect Four ---
  socket.on('createConnectFourRoom', (roomCode) => {
    rooms[roomCode]={type:'c4',board:Array(6).fill(null).map(()=>Array(7).fill('')),currentPlayer:'1'};
    socket.join(roomCode);
    socket.emit('connectFourRoomCreated',roomCode);
  });

  socket.on('joinConnectFourRoom', (roomCode) => {
    if(rooms[roomCode]){
      socket.join(roomCode);
      socket.emit('connectFourRoomJoined',roomCode);
      io.to(roomCode).emit('connectFourStart',rooms[roomCode]);
    } else socket.emit('error','Room not found');
  });

  socket.on('connectFourMove', ({roomCode,col}) => {
    const room=rooms[roomCode];
    if(!room) return;
    let row=-1;
    for(let r=5;r>=0;r--){if(!room.board[r][col]){row=r;break;}}
    if(row===-1) return;
    room.board[row][col]=room.currentPlayer;
    room.currentPlayer=room.currentPlayer==='1'?'2':'1';
    io.to(roomCode).emit('connectFourMoveMade',{board:room.board,currentPlayer:room.currentPlayer});
    const winner=checkConnectFourWinner(room.board);
    if(winner){io.to(roomCode).emit('connectFourGameOver',{winner});delete rooms[roomCode];}
    else if(room.board.every(r=>r.every(c=>c))){io.to(roomCode).emit('connectFourGameOver',{winner:'draw'});delete rooms[roomCode];}
  });

  // --- Nine Men's Morris ---
  socket.on('createMorrisRoom', (roomCode) => {
    rooms[roomCode]={
      type:'morris',
      board:Array(24).fill(''),
      currentPlayer:'1',
      phase:'place',
      piecesToPlace:{'1':9,'2':9},
      mustRemove:false
    };
    socket.join(roomCode);
    socket.emit('morrisRoomCreated',roomCode);
  });

  socket.on('joinMorrisRoom', (roomCode) => {
    if(rooms[roomCode]){
      socket.join(roomCode);
      socket.emit('morrisRoomJoined',roomCode);
      io.to(roomCode).emit('morrisStart',rooms[roomCode]);
    } else socket.emit('error','Room not found');
  });

  socket.on('morrisMove', ({roomCode,type,from,to}) => {
    const room=rooms[roomCode];
    if(!room) return;
    const p=room.currentPlayer;
    const opp=p==='1'?'2':'1';

    if(type==='place'&&room.phase==='place'){
      if(room.board[to]!=='') return;
      room.board[to]=p;
      room.piecesToPlace[p]--;
      if(checkMill(room.board,to,p)){
        room.phase='remove';
      } else {
        room.currentPlayer=opp;
        if(room.piecesToPlace['1']===0&&room.piecesToPlace['2']===0) room.phase='move';
      }
    } else if(type==='move'&&(room.phase==='move'||room.phase==='fly')){
      if(room.board[from]!==p||room.board[to]!=='') return;
      const canFly=countPieces(room.board,p)===3;
      if(!canFly&&!MORRIS_ADJACENCY[from].includes(to)) return;
      room.board[from]='';
      room.board[to]=p;
      if(checkMill(room.board,to,p)){
        room.phase='remove';
      } else {
        room.currentPlayer=opp;
        const oppCount=countPieces(room.board,opp);
        if(oppCount<=2){io.to(roomCode).emit('morrisGameOver',{winner:p});delete rooms[roomCode];return;}
        room.phase=countPieces(room.board,opp)===3?'fly':'move';
      }
    } else if(type==='remove'&&room.phase==='remove'){
      if(room.board[from]!==opp) return;
      const oppAllInMills=allInMills(room.board,opp);
      if(!oppAllInMills&&isInAnyMill(room.board,from)) return;
      room.board[from]='';
      room.currentPlayer=opp;
      if(room.piecesToPlace[p]>0||room.piecesToPlace[opp]>0) room.phase='place';
      else {
        const oppCount=countPieces(room.board,opp);
        if(oppCount<=2){io.to(roomCode).emit('morrisGameOver',{winner:p});delete rooms[roomCode];return;}
        room.phase=countPieces(room.board,opp)===3?'fly':'move';
      }
    }

    io.to(roomCode).emit('morrisUpdate',room);
  });

  // --- Chess ---
  socket.on('createChessRoom', (roomCode) => {
    rooms[roomCode]={
      type:'chess',
      board:CHESS_INIT.map(r=>[...r]),
      currentPlayer:'w'
    };
    socket.join(roomCode);
    socket.emit('chessRoomCreated',roomCode);
  });

  socket.on('joinChessRoom', (roomCode) => {
    if(rooms[roomCode]){
      socket.join(roomCode);
      socket.emit('chessRoomJoined',roomCode);
      io.to(roomCode).emit('chessStart',rooms[roomCode]);
    } else socket.emit('error','Room not found');
  });

  socket.on('chessMove', ({roomCode,from,to}) => {
    const room=rooms[roomCode];
    if(!room) return;
    const p=room.currentPlayer;
    if(!isValidChessMove(room.board,from,to,p)) return;
    const newBoard=room.board.map(r=>[...r]);
    let piece=newBoard[from[0]][from[1]];
    newBoard[to[0]][to[1]]=piece;
    newBoard[from[0]][from[1]]=null;
    if(piece==='wP'&&to[0]===0) newBoard[to[0]][to[1]]='wQ';
    if(piece==='bP'&&to[0]===7) newBoard[to[0]][to[1]]='bQ';
    if(isKingInCheck(newBoard,p)) return;
    room.board=newBoard;
    const opp=p==='w'?'b':'w';
    if(!hasAnyValidMove(room.board,opp)){
      io.to(roomCode).emit('chessUpdate',room);
      if(isKingInCheck(room.board,opp)){
        io.to(roomCode).emit('chessGameOver',{winner:p});
      } else {
        io.to(roomCode).emit('chessGameOver',{winner:'stalemate'});
      }
      delete rooms[roomCode];
      return;
    }
    room.currentPlayer=opp;
    io.to(roomCode).emit('chessUpdate',room);
  });

  // --- Drawing Game ---
  socket.on('createDrawingRoom', ({roomCode,player}) => {
    rooms[roomCode]={
      type:'drawing',
      players:[player],
      scores:{[player]:0},
      currentDrawer:null,
      currentWord:null,
      roundActive:false,
      roundTimer:null,
      correctGuessers:[]
    };
    socket.join(roomCode);
    socket.data.player=player;
    socket.data.room=roomCode;
    socket.emit('drawingRoomCreated',roomCode);
  });

  socket.on('joinDrawingRoom', ({roomCode,player}) => {
    const room=rooms[roomCode];
    if(!room){socket.emit('error','Room not found');return;}
    room.players.push(player);
    room.scores[player]=0;
    socket.join(roomCode);
    socket.data.player=player;
    socket.data.room=roomCode;
    socket.emit('drawingRoomJoined',roomCode);
    if(room.players.length>=2&&!room.roundActive) startDrawingRound(roomCode);
  });

  function startDrawingRound(roomCode){
    const room=rooms[roomCode];
    if(!room) return;
    const drawerIdx=room.players.indexOf(room.currentDrawer);
    const nextIdx=(drawerIdx+1)%room.players.length;
    room.currentDrawer=room.players[nextIdx];
    room.currentWord=WORDS[Math.floor(Math.random()*WORDS.length)];
    room.roundActive=true;
    room.correctGuessers=[];
    const timeLimit=60;
    io.to(roomCode).emit('drawingStart',{
      drawer:room.currentDrawer,
      word:room.currentWord,
      timeLimit,
      players:room.players
    });
    room.roundTimer=setTimeout(()=>endDrawingRound(roomCode),timeLimit*1000);
  }

  function endDrawingRound(roomCode){
    const room=rooms[roomCode];
    if(!room) return;
    room.roundActive=false;
    clearTimeout(room.roundTimer);
    const nextDrawer=room.players[(room.players.indexOf(room.currentDrawer)+1)%room.players.length];
    io.to(roomCode).emit('drawingRoundOver',{word:room.currentWord,nextDrawer});
    if(room.players.indexOf(room.currentDrawer)===room.players.length-1){
      io.to(roomCode).emit('drawingGameOver',{scores:room.scores});
      delete rooms[roomCode];
    } else {
      setTimeout(()=>startDrawingRound(roomCode),3000);
    }
  }

  socket.on('drawing', ({roomCode,x0,y0,x1,y1,color,size}) => {
    socket.to(roomCode).emit('drawing',{x0,y0,x1,y1,color,size});
  });

  socket.on('drawingClear', ({roomCode}) => {
    socket.to(roomCode).emit('drawingClear');
  });

  socket.on('drawingGuess', ({roomCode,guess,player}) => {
    const room=rooms[roomCode];
    if(!room||!room.roundActive) return;
    if(guess.toLowerCase()===room.currentWord.toLowerCase()){
      room.scores[player]=(room.scores[player]||0)+1;
      room.correctGuessers.push(player);
      io.to(roomCode).emit('drawingCorrectGuess',{player,word:room.currentWord});
      if(room.correctGuessers.length>=room.players.length-1){
        clearTimeout(room.roundTimer);
        endDrawingRound(roomCode);
      }
    } else {
      io.to(roomCode).emit('drawingWrongGuess',{player,guess});
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

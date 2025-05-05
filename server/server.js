const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: ['https://agario-production-4f2c.up.railway.app'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'client')));

const playerActivity = new Map();
const lastChatMessage = new Map();
const INACTIVITY_TIMEOUT = 120000;

function cleanInactivePlayers() {
    const now = Date.now();
    for (let [socketId, lastActivityTime] of playerActivity.entries()) {
        if (now - lastActivityTime > INACTIVITY_TIMEOUT) {
            game.removePlayer(socketId);
            playerActivity.delete(socketId);
            io.emit('playerInactive', socketId);
        }
    }
}

setInterval(cleanInactivePlayers, 10000);

io.on('connection', (socket) => {
    playerActivity.set(socket.id, Date.now());

    socket.on('setPlayerName', (name) => {
        if (typeof name !== 'string' || name.trim() === '') {
            console.error('Некорректное имя игрока:', name);
            socket.emit('setPlayerNameResponse', { success: false, message: 'Некорректное имя' });
            return;
        }
        const sanitizedName = name.trim().slice(0, 20).replace(/[<>]/g, '');
        const result = game.setPlayerName(socket.id, sanitizedName, io);
        if (result.success) {
            playerActivity.set(socket.id, Date.now());
            io.emit('updateGameState', game.getGameState());
            socket.emit('setPlayerNameResponse', { 
                success: true, 
                player: { x: result.player.x, y: result.player.y, size: result.player.size, name: sanitizedName }
            });
        } else {
            socket.emit('setPlayerNameResponse', { success: false, message: result.message });
            if (result.removePlayer) {
                game.removePlayer(socket.id);
            }
        }
    });

    socket.on('restorePlayer', (data) => {
        if (!data || typeof data.name !== 'string') {
            socket.emit('restorePlayerResponse', { success: false, message: 'Некорректные данные для восстановления' });
            return;
        }
        const sanitizedName = data.name.trim().slice(0, 20).replace(/[<>]/g, '');
        const existingPlayer = Array.from(game.players.entries()).find(([id, p]) => p.name === sanitizedName && id !== socket.id);
        if (existingPlayer) {
            const [oldId, playerData] = existingPlayer;
            if (!isFinite(playerData.x) || !isFinite(playerData.y) || !isFinite(playerData.size)) {
                socket.emit('restorePlayerResponse', { success: false, message: 'Некорректные данные игрока' });
                return;
            }
            game.players.delete(oldId);
            io.emit('playerInactive', oldId);
            game.players.set(socket.id, new game.Player(socket.id, playerData.x, playerData.y, playerData.size));
            game.players.get(socket.id).name = sanitizedName;
            socket.emit('restorePlayerResponse', { success: true, player: { x: playerData.x, y: playerData.y, size: playerData.size, name: sanitizedName } });
            io.emit('updateGameState', game.getGameState());
        } else {
            socket.emit('restorePlayerResponse', { success: false, message: 'Игрок не найден' });
        }
    });

    socket.on('updatePlayerPosition', (data) => {
        if (!data || typeof data.directionX !== 'number' || typeof data.directionY !== 'number' || !isFinite(data.directionX) || !isFinite(data.directionY)) {
            console.error('Некорректное обновление позиции от', socket.id, ':', data);
            return;
        }
        const magnitude = Math.sqrt(data.directionX ** 2 + data.directionY ** 2);
        if (magnitude > 1.1) {
            return;
        }
        const now = Date.now();
        const lastActivity = playerActivity.get(socket.id) || now;
        const deltaTime = (now - lastActivity) / 1000;
        if (game.updatePlayer(socket.id, data, playerActivity, deltaTime)) {
            io.emit('updateGameState', game.getGameState(now, socket.id));
        }
    });

    socket.on('setCanvasSize', (data) => {
        if (game.setCanvasSize(data)) {
            socket.emit('updateGameState', game.getGameState());
        }
    });

    socket.on('eatFood', (data) => {
        if (game.eatFood(socket.id, data)) {
            playerActivity.set(socket.id, Date.now());
            io.emit('updateGameState', game.getGameState());
        }
    });

    socket.on('chatMessage', (data) => {
        if (!data || typeof data.name !== 'string' || typeof data.message !== 'string' || data.message.trim() === '') {
            console.error('Некорректное сообщение чата:', data);
            return;
        }
        const now = Date.now();
        if (lastChatMessage.get(socket.id) && now - lastChatMessage.get(socket.id) < 1000) {
            return;
        }
        lastChatMessage.set(socket.id, now);
        const sanitizedMessage = data.message.trim().slice(0, 100).replace(/[<>]/g, '');
        io.emit('chatMessage', { name: data.name.slice(0, 20), message: sanitizedMessage });
    });

    socket.on('setPaused', (isPaused) => {
        game.setPlayerPaused(socket.id, isPaused);
    });

    socket.on('disconnect', () => {
        game.removePlayer(socket.id);
        playerActivity.delete(socket.id);
        io.emit('playerInactive', socket.id);
        io.emit('updateGameState', game.getGameState());
    });
});

let lastTime = Date.now();
let deltaTime = 0.016;

setInterval(() => {
    const now = Date.now();
    deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    game.checkPlayerCollisions(io);
    io.sockets.sockets.forEach((socket) => {
        const state = game.getGameState(now, socket.id);
        if (state) socket.emit('updateGameState', state);
    });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
});

process.on('SIGINT', () => {
    server.close(() => {
        process.exit(0);
    });
});

io.on('error', (error) => {
    console.error('Ошибка Socket.IO:', error);
});

server.on('error', (error) => {
    console.error('Ошибка сервера:', error);
});

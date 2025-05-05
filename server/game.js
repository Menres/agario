const Player = require('./player-serv');
const Food = require('./food-serv');
const { v4: uuidv4 } = require('uuid');

let canvasWidth = 1000;
let canvasHeight = 1000;
let players = new Map();
const FOOD_COUNT = 80;
const MAX_PLAYER_SIZE = 500;

function createFood() {
    const foods = [];
    const colors = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < FOOD_COUNT; i++) {
        let x, y, attempts = 0;
        const maxAttempts = 10;
        do {
            x = Math.random() * canvasWidth;
            y = Math.random() * canvasHeight;
            attempts++;
            var isSafe = true;
            for (let [, player] of players) {
                const d = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
                if (d < player.size / 2 + 10) {
                    isSafe = false;
                    break;
                }
            }
        } while (!isSafe && attempts < maxAttempts);
        const colorIndex = colors[Math.floor(Math.random() * colors.length)];
        foods.push(new Food(x, y, 10, colorIndex, uuidv4()));
    }
    return foods;
}

let foods = createFood();

function createPlayer(socketId, name) {
    if (players.has(socketId)) {
        return null;
    }
    let x, y, attempts = 0;
    const maxAttempts = 10;
    do {
        x = canvasWidth / 2 + (Math.random() * 2 - 1) * 10;
        y = canvasHeight / 2 + (Math.random() * 2 - 1) * 10;
        attempts++;
        var isSafe = true;
        for (let [, player] of players) {
            const d = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
            if (d < player.size / 2 + 20) {
                isSafe = false;
                break;
            }
        }
    } while (!isSafe && attempts < maxAttempts);
    const newPlayer = new Player(socketId, x, y, 20);
    if (name) {
        newPlayer.name = name;
    }
    players.set(socketId, newPlayer);
    return newPlayer;
}

function setCanvasSize(data) {
    if (!data || typeof data.width !== 'number' || typeof data.height !== 'number' || !isFinite(data.width) || !isFinite(data.height) || data.width <= 0 || data.height <= 0) {
        return false;
    }
    canvasWidth = data.width;
    canvasHeight = data.height;
    foods = createFood();
    return true;
}

function setPlayerName(socketId, name, io) {
    const sanitizedName = name.replace(/[<>]/g, '');
    const nameLowerCase = sanitizedName.toLowerCase();

    for (let [id, player] of players.entries()) {
        if (id !== socketId && player.name && player.name.toLowerCase() === nameLowerCase) {
            io.to(socketId).emit('nameTaken');
            return { success: false, message: 'Имя уже занято', removePlayer: false };
        }
    }

    if (players.has(socketId)) {
        const player = players.get(socketId);
        player.name = sanitizedName;
        return { success: true, player: { x: player.x, y: player.y, size: player.size, name: sanitizedName }, removePlayer: false };
    }

    const newPlayer = createPlayer(socketId, sanitizedName);
    if (!newPlayer) {
        return { success: false, message: 'Не удалось создать игрока', removePlayer: true };
    }
    return { success: true, player: { x: newPlayer.x, y: newPlayer.y, size: newPlayer.size, name: sanitizedName }, removePlayer: false };
}

function setPlayerPaused(socketId, isPaused) {
    const player = players.get(socketId);
    if (player) {
        player.isPaused = isPaused;
    }
}

function updatePlayer(socketId, data, playerActivity, deltaTime) {
    const player = players.get(socketId);
    if (!player) {
        return false;
    }
    if (!data || typeof data.directionX !== 'number' || !isFinite(data.directionX) || typeof data.directionY !== 'number' || !isFinite(data.directionY)) {
        return false;
    }
    try {
        const now = Date.now();
        if (player.isPaused) {
            return false;
        }

        const speed = player.getSpeed();
        const adjustedSpeed = speed * deltaTime;
        player.x += data.directionX * adjustedSpeed;
        player.y += data.directionY * adjustedSpeed;
        player.x = Math.max(player.size / 2, Math.min(canvasWidth - player.size / 2, player.x));
        player.y = Math.max(player.size / 2, Math.min(canvasHeight - player.size / 2, player.y));
        playerActivity.set(socketId, Date.now());
        
        return true;
    } catch (error) {
        return false;
    }
}

function eatFood(socketId, data) {
    if (!data || typeof data.id !== 'string' || typeof data.playerX !== 'number' || !isFinite(data.playerX) || typeof data.playerY !== 'number' || !isFinite(data.playerY)) {
        return false;
    }
    const player = players.get(socketId);
    const foodIndex = foods.findIndex(f => f.id === data.id);
    if (foodIndex === -1) {
        return false;
    }
    const food = foods[foodIndex];
    if (!player || !food) {
        return false;
    }
    if (!isFinite(food.x) || !isFinite(food.y)) {
        return false;
    }
    const d = Math.sqrt((data.playerX - food.x) ** 2 + (data.playerY - food.y) ** 2);
    const requiredDistance = (player.size + food.size) / 2;
    if (d >= requiredDistance) {
        return false;
    }
    player.size += 2;
    player.size = Math.min(player.size, MAX_PLAYER_SIZE);
    player.x = data.playerX;
    player.y = data.playerY;
    foods.splice(foodIndex, 1);
    let x, y, attempts = 0;
    const maxAttempts = 10;
    do {
        x = Math.random() * canvasWidth;
        y = Math.random() * canvasHeight;
        attempts++;
        var isSafe = true;
        for (let [, player] of players) {
            const d = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
            if (d < player.size / 2 + 10) {
                isSafe = false;
                break;
            }
        }
    } while (!isSafe && attempts < maxAttempts);
    const colorIndex = food.colorIndex;
    foods.push(new Food(x, y, 10, colorIndex, uuidv4()));
    return true;
}

function getGameState(serverTime, socketId) {
    const player = socketId ? players.get(socketId) : null;
    const gameState = {
        serverTime: serverTime || Date.now(),
        foods: foods.map(f => ({ id: f.id, x: f.x, y: f.y, size: f.size, colorIndex: f.colorIndex })),
        players: Array.from(players.entries()).reduce((obj, [id, p]) => {
            obj[id] = { x: p.x, y: p.y, size: p.size, name: p.name };
            return obj;
        }, {})
    };
    return gameState;
}

function removePlayer(socketId) {
    if (players.has(socketId)) {
        players.delete(socketId);
    }
}

function checkPlayerCollisions(io) {
    const playerEntries = Array.from(players.entries());
    const toRemove = [];
    const collisionCache = new Map();
    for (let i = 0; i < playerEntries.length; i++) {
        for (let j = i + 1; j < playerEntries.length; j++) {
            const [id1, p1] = playerEntries[i];
            const [id2, p2] = playerEntries[j];
            const d = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            const cacheKey = `${id1}:${id2}:${p1.x}:${p1.y}:${p2.x}:${p2.y}`;
            if (d < (p1.size + p2.size) / 2) {
                if (p1.size > p2.size * 1.2) {
                    p1.size += p2.size * 0.5;
                    p1.size = Math.min(p1.size, MAX_PLAYER_SIZE);
                    toRemove.push(id2);
                    io.emit('playerEaten', { eatenId: id2, eaterId: id1 });
                } else if (p2.size > p1.size * 1.2) {
                    p2.size += p1.size * 0.5;
                    p2.size = Math.min(p2.size, MAX_PLAYER_SIZE);
                    toRemove.push(id1);
                    io.emit('playerEaten', { eatenId: id1, eaterId: id2 });
                }
            }
        }
    }
    toRemove.forEach(id => players.delete(id));
    io.emit('updateGameState', getGameState(Date.now()));
}

module.exports = {
    players,
    createPlayer,
    setCanvasSize,
    setPlayerName,
    setPlayerPaused,
    updatePlayer,
    eatFood,
    getGameState,
    removePlayer,
    checkPlayerCollisions
};

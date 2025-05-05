let player;
let foods = [];
let otherPlayers = new Map();
let cameraX = 0;
let cameraY = 0;
let targetCameraX = 0;
let targetCameraY = 0;
let worldWidth = 1000;
let worldHeight = 1000;
let gameState = 'menu';
let playerName = '';
let nickInput;
let playButton;
let themeButton;
let backgroundTheme = 'light';
let scoreboard = [];
let chatMessages = [];
let chatInput;
let isChatOpen = false;
let showScoreboard = true;
let toggleScoreboardButton;
const MAX_PLAYER_SIZE = 500;
let isPaused = false;
let gameInitialized = false;
let lastDirectionX = 0;
let lastDirectionY = 0;
let lastFrameTime = Date.now();
let eatenFoodIds = new Set();
let zoom = 1.0;
const minZoom = 0.5;
const maxZoom = 2.0;
const PLAYER_TIMEOUT = 10000;

function setup() {
    if (!window.createCanvas) {
        return;
    }
    window.createCanvas(windowWidth, windowHeight);
    window.frameRate(60);

    nickInput = window.createInput('');
    nickInput.position(windowWidth / 2 - 100, windowHeight / 2 - 20);
    nickInput.size(200, 30);
    nickInput.attribute('placeholder', 'Введите ваш ник');

    playButton = window.createButton('Играть');
    playButton.position(windowWidth / 2 - 50, windowHeight / 2 + 20);
    playButton.size(100, 40);
    playButton.mousePressed(startGame);
    playButton.class('play-button');

    themeButton = window.createButton('Сменить фон');
    themeButton.position(windowWidth - 140, 20);
    themeButton.size(120, 40);
    themeButton.mousePressed(toggleBackgroundTheme);
    themeButton.class('theme-button');
    themeButton.hide();

    toggleScoreboardButton = window.createButton('Скрыть лидеров');
    toggleScoreboardButton.position(windowWidth - 140, 70);
    toggleScoreboardButton.size(120, 30);
    toggleScoreboardButton.mousePressed(toggleScoreboardVisibility);
    toggleScoreboardButton.class('scoreboard-button');
    toggleScoreboardButton.hide();

    chatInput = window.createInput('');
    chatInput.position(20, windowHeight - 50);
    chatInput.size(300, 30);
    chatInput.hide();
    chatInput.class('chat-input');

    socket.on('connect', () => {
        if (!socket.id) {
            return;
        }
    });

    socket.on('setPlayerNameResponse', (data) => {
        if (data.success && data.player) {
            player = new Player(socket.id, data.player.x, data.player.y, data.player.size, data.player.name);
            playerName = data.player.name;
            nickInput.hide();
            playButton.hide();
            themeButton.show();
            toggleScoreboardButton.show();
            eatenFoodIds.clear();
            gameState = 'playing';
            gameInitialized = true;
        } else {
            window.alert(data.message);
            gameState = 'menu';
            showMenu();
        }
    });

    socket.on('playerInactive', (socketId) => {
        if (socketId === socket.id) {
            gameState = 'menu';
            showMenu();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            if (otherPlayers.has(socketId)) {
                otherPlayers.delete(socketId);
            }
        }
    });

    socket.on('updateGameState', (data) => {
        if (!data || !Array.isArray(data.foods) || !data.players || !data.serverTime) {
            return;
        }

        const clientTime = Date.now();
        eatenFoodIds.forEach(id => {
            if (!data.foods.find(f => f.id === id)) {
                eatenFoodIds.delete(id);
            }
        });

        const newFoods = [];
        const existingFoodMap = new Map(foods.map(food => [food.id, food]));
        data.foods.forEach(f => {
            if (!f.id || !isFinite(f.x) || !isFinite(f.y) || !isFinite(f.size)) {
                return;
            }
            if (existingFoodMap.has(f.id)) {
                const food = existingFoodMap.get(f.id);
                food.x = f.x;
                food.y = f.y;
                food.size = f.size;
                food.colorIndex = f.colorIndex;
                newFoods.push(food);
                existingFoodMap.delete(f.id);
            } else {
                newFoods.push(new Food(f.x, f.y, f.size, f.colorIndex, f.id));
            }
        });

        foods = newFoods;

        let playersData = [];
        for (let id in data.players) {
            const p = data.players[id];
            if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.size)) {
                continue;
            }

            playersData.push({ id, name: p.name || `Player${id.slice(0, 4)}`, size: p.size || 20 });

            if (id === socket.id) {
                if (player) {
                    player.updateFromServer(p.x, p.y, data.serverTime);
                    player.targetSize = p.size || 20;
                    player.lastUpdate = clientTime;
                }
            } else {
                if (otherPlayers.has(id)) {
                    const player = otherPlayers.get(id);
                    player.updateFromServer(p.x, p.y, data.serverTime);
                    player.targetSize = p.size || 20;
                    player.name = p.name || `Player${id.slice(0, 4)}`;
                    player.lastUpdate = clientTime;
                } else {
                    const newPlayer = new Player(id, p.x, p.y, p.size || 20, p.name || `Player${id.slice(0, 4)}`);
                    newPlayer.lastUpdate = clientTime;
                    otherPlayers.set(id, newPlayer);
                }
            }
        }

        scoreboard = playersData.sort((a, b) => b.size - a.size).slice(0, 5);
        gameInitialized = true;
    });

    socket.on('chatMessage', (data) => {
        chatMessages.push({ name: data.name, message: data.message, timestamp: Date.now() });
    });

    socket.on('playerEaten', (data) => {
        if (data.eatenId === socket.id) {
            gameState = 'menu';
            showMenu();
            setTimeout(() => alert('Вы были съедены!'), 100);
        }
        if (otherPlayers.has(data.eatenId)) {
            otherPlayers.delete(data.eatenId);
        }
        window.redraw();
    });

    socket.on('nameTaken', () => {
        gameState = 'menu';
        showMenu();
        setTimeout(() => {
            window.alert('Это имя уже занято! Пожалуйста, выберите другое.');
        }, 100);
    });
}

function startGame() {
    const nick = nickInput.value().trim();
    if (nick === '') {
        window.alert('Пожалуйста, введите ник');
        return;
    }
    if (!socket.id) {
        window.alert('Ошибка подключения к серверу. Пожалуйста, обновите страницу.');
        return;
    }

    socket.emit('setPlayerName', nick);
}

function showMenu() {
    nickInput.show();
    playButton.show();
    themeButton.hide();
    toggleScoreboardButton.hide();
    chatInput.hide();
    isChatOpen = false;
    gameInitialized = false;
}

function toggleBackgroundTheme() {
    backgroundTheme = backgroundTheme === 'light' ? 'dark' : 'light';
}

function toggleScoreboardVisibility() {
    showScoreboard = !showScoreboard;
    toggleScoreboardButton.html(showScoreboard ? 'Скрыть лидеров' : 'Показать лидеров');
}

let lastUpdateTime = 0;

function draw() {
    if (!window.background || !window.textAlign) {
        return;
    }
    window.clear();

    const now = Date.now();
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    chatMessages = chatMessages.filter(msg => now - msg.timestamp < 30000);

    if (isPaused) {
        window.textAlign(window.CENTER);
        window.textSize(32);
        window.fill(255, 0, 0);
        window.text('ПАУЗА', windowWidth / 2, windowHeight / 2);
        return;
    }

    if (gameState === 'menu') {
        window.background(220);
        window.textAlign(window.CENTER);
        window.textSize(32);
        window.fill(0);
        window.text('Добро пожаловать!', windowWidth / 2, windowHeight / 2 - 100);
    } else if (gameState === 'playing' && player) {
        if (!gameInitialized) {
            window.background(220);
            window.textAlign(window.CENTER);
            window.textSize(32);
            window.fill(0);
            window.text('Загрузка...', windowWidth / 2, windowHeight / 2);
            return;
        }

        if (isFinite(player.x) && isFinite(player.y)) {
            targetCameraX = player.x - (windowWidth / 2) / zoom;
            targetCameraY = player.y - (windowHeight / 2) / zoom;
            targetCameraX = window.constrain(targetCameraX, 0, worldWidth - windowWidth / zoom);
            targetCameraY = window.constrain(targetCameraY, 0, worldHeight - windowHeight / zoom);

            cameraX = window.lerp(cameraX, targetCameraX, 0.3);
            cameraY = window.lerp(cameraY, targetCameraY, 0.3);
        } else {
            cameraX = 0;
            cameraY = 0;
        }

        window.push();
        window.translate(-cameraX * zoom, -cameraY * zoom);
        window.scale(zoom);

        drawGridBackground();

        const dx = (window.mouseX / zoom) + cameraX - player.x;
        const dy = (window.mouseY / zoom) + cameraY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let directionX = 0;
        let directionY = 0;
        if (distance > 0) {
            directionX = dx / distance;
            directionY = dy / distance;
        }

        if (!isPaused) {
            if (player) player.interpolate(deltaTime, window);
            otherPlayers.forEach(p => p.interpolate(deltaTime, window));
        }

        player.display(window);

        if (!isPaused && now - lastUpdateTime > 5) {
            socket.emit('updatePlayerPosition', { directionX, directionY });
            lastUpdateTime = now;
            lastDirectionX = directionX;
            lastDirectionY = directionY;
        }

        otherPlayers.forEach((player, id) => {
            if (now - player.lastUpdate > PLAYER_TIMEOUT) {
                otherPlayers.delete(id);
            } else {
                player.display(window);
            }
        });

        for (let i = 0; i < foods.length; i++) {
            let food = foods[i];
            if (!food || !isFinite(food.x) || !isFinite(food.y) || !food.id) {
                continue;
            }
            if (
                food.x > cameraX - food.size &&
                food.x < cameraX + windowWidth / zoom + food.size &&
                food.y > cameraY - food.size &&
                food.y < cameraY + windowHeight / zoom + food.size
            ) {
                food.display(window);
            }
            let d = window.dist(player.x, player.y, food.x, food.y);
            if (!isPaused && d < (player.size + food.size) / 2 && !eatenFoodIds.has(food.id)) {
                if (!isFinite(player.x) || !isFinite(player.y)) {
                    continue;
                }
                socket.emit('eatFood', { id: food.id, playerX: player.x, playerY: player.y });
                eatenFoodIds.add(food.id);
            }
        }

        window.pop();

        if (showScoreboard) {
            drawScoreboard();
        }

        if (isChatOpen) {
            drawChat();
        }

        if (now - lastUpdateTime > 1000) {
            eatenFoodIds.forEach(id => {
                if (!foods.find(f => f.id === id)) eatenFoodIds.delete(id);
            });
        }
    }
}

function drawGridBackground() {
    if (backgroundTheme === 'light') {
        window.background(220, 223, 220);
        window.stroke(200, 203, 200);
    } else {
        window.background(51, 51, 51);
        window.stroke(85, 85, 85);
    }
    window.strokeWeight(1 / zoom);

    for (let x = 0; x <= worldWidth; x += 50) {
        window.line(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += 50) {
        window.line(0, y, worldWidth, y);
    }

    window.noFill();
    if (backgroundTheme === 'light') {
        window.stroke(50, 50, 50);
    } else {
        window.stroke(200, 200, 200);
    }
    window.strokeWeight(10 / zoom);
    window.rect(0, 0, worldWidth, worldHeight, 20);
    window.noStroke();
}

function drawScoreboard() {
    window.push();
    window.textAlign(window.LEFT);
    window.textSize(18);
    window.fill(50, 50, 50, 220);
    window.stroke(255, 255, 355, 100);
    window.strokeWeight(1);
    window.rect(windowWidth - 240, 110, 220, 30 + scoreboard.length * 30, 20);
    window.noStroke();
    window.fill(255);
    window.text('Лидеры:', windowWidth - 220, 135);
    scoreboard.forEach((p, i) => {
        window.text(`${i + 1}. ${p.name}: ${Math.floor(p.size)}`, windowWidth - 220, 160 + i * 30);
    });
    window.pop();
}

function drawChat() {
    window.push();
    window.textAlign(window.LEFT);
    window.textSize(14);
    window.fill(0, 0, 0, 200);
    window.rect(20, windowHeight - 200, 300, 140);
    window.fill(255);
    chatMessages.forEach((msg, i) => {
        window.text(`${msg.name}: ${msg.message}`, 30, windowHeight - 180 + i * 20);
    });
    window.pop();
}

function keyPressed() {
    if (window.keyCode === window.ESCAPE && gameState === 'playing') {
        gameState = 'menu';
        showMenu();
        return;
    }
    if (window.keyCode === window.ENTER) {
        if (gameState === 'playing') {
            if (isChatOpen) {
                const message = chatInput.value().trim().slice(0, 100).replace(/[<>]/g, '');
                if (message) {
                    socket.emit('chatMessage', { name: player.name, message });
                    chatInput.value('');
                }
                chatInput.hide();
                isChatOpen = false;
            } else {
                chatInput.show();
                chatInput.elt.focus();
                isChatOpen = true;
            }
        }
    }
    if (window.keyCode === 80) {
        isPaused = !isPaused;
        socket.emit('setPaused', isPaused);
    }
}

function windowResized() {
    if (!window.resizeCanvas) return;
    window.resizeCanvas(windowWidth, windowHeight);
    if (gameState === 'menu') {
        nickInput.position(windowWidth / 2 - 100, windowHeight / 2 - 20);
        playButton.position(windowWidth / 2 - 50, windowHeight / 2 + 20);
    }
    if (gameState === 'playing') {
        themeButton.position(Math.min(windowWidth - 140, windowWidth - 140), 20);
        toggleScoreboardButton.position(Math.min(windowWidth - 140, windowWidth - 140), 70);
        chatInput.position(20, windowHeight - 50);
        socket.emit('setCanvasSize', { width: worldWidth, height: worldHeight });
    }
}

function mouseWheel(event) {
    if (gameState === 'playing') {
        const zoomSpeed = 0.1;
        zoom += event.delta > 0 ? -zoomSpeed : zoomSpeed;
        zoom = window.constrain(zoom, minZoom, maxZoom);
        return false;
    }
}

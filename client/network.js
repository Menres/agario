const socket = io('agario-production-4f2c.up.railway.app', {
    reconnectionAttempts: 10,
    timeout: 10000,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

socket.on('connect', () => {
    if (typeof worldWidth === 'number' && typeof worldHeight === 'number' && isFinite(worldWidth) && isFinite(worldHeight)) {
        socket.emit('setCanvasSize', { width: worldWidth, height: worldHeight });
    } else {
        console.error('Invalid world dimensions');
    }
});

socket.on('reconnect', () => {
    if (typeof worldWidth === 'number' && typeof worldHeight === 'number' && isFinite(worldWidth) && isFinite(worldHeight)) {
        socket.emit('setCanvasSize', { width: worldWidth, height: worldHeight });
    }
    if (playerName) {
        socket.emit('restorePlayer', { name: playerName });
    } else {
        gameState = 'menu';
        showMenu();
    }
});

socket.on('restorePlayerResponse', (data) => {
    if (data.success && data.player) {
        player = new Player(socket.id, data.player.x, data.player.y, data.player.size, data.player.name);
        gameState = 'playing';
        nickInput.hide();
        playButton.hide();
        themeButton.show();
        toggleScoreboardButton.show();
        gameInitialized = true;
    } else {
        gameState = 'menu';
        showMenu();
    }
});

socket.on('disconnect', () => {
});

socket.on('reconnect_attempt', () => {
});

socket.on('reconnect_failed', () => {
    console.error('Reconnection failed after maximum attempts');
});

socket.on('error', (error) => {
    console.error('Socket.IO error:', error);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

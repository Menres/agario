class Player {
    constructor(id, x, y, size, name) {
        if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number' || typeof size !== 'number' || size <= 0 || !isFinite(x) || !isFinite(y) || !isFinite(size)) {
            throw new Error('Invalid player parameters');
        }
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = size;
        this.baseSpeed = 600;
        this.targetX = x;
        this.targetY = y;
        this.targetSize = size;
        this.name = name || `Player${id.slice(0, 4)}`;
        this.lastX = x;
        this.lastY = y;
        this.lastSize = size;
        this.maxSize = 500;
        this.lastUpdateTime = Date.now();
        this.lastClientUpdateTime = Date.now();
        this.lastLogTime = 0;
        this.LOG_INTERVAL = 1000;

        const colors = [
            [255, 87, 87],
            [87, 255, 87],
            [87, 87, 255],
            [255, 255, 87],
            [255, 87, 255],
            [87, 255, 255],
        ];
        this.color = window.random ? window.random(colors) : colors[Math.floor(Math.random() * colors.length)];
    }

    getSpeed() {
        return this.baseSpeed / Math.sqrt(this.size);
    }

    updateFromServer(x, y, serverTime) {
        this.targetX = x;
        this.targetY = y;
        this.lastUpdateTime = serverTime || Date.now();
    }

    interpolate(deltaTime, p) {
        const now = Date.now();
        deltaTime = Math.min(deltaTime || (now - this.lastUpdateTime) / 1000, 0.1);
        if (!isFinite(this.targetX) || !isFinite(this.targetY)) {
            console.error(`[Player ${this.id}] Invalid target position for interpolation: targetX=${this.targetX}, targetY=${this.targetY}`);
            this.x = this.lastX;
            this.y = this.lastY;
        } else {
            const factor = Math.min(1, deltaTime * 15);
            this.x = p.lerp(this.x, this.targetX, factor);
            this.y = p.lerp(this.y, this.targetY, factor);
            if (!isFinite(this.x) || !isFinite(this.y)) {
                console.error(`[Player ${this.id}] Interpolation resulted in invalid position: x=${this.x}, y=${this.y}`);
                this.x = this.lastX;
                this.y = this.lastY;
            }
        }
        this.size = p.lerp(this.size, Math.min(this.targetSize, this.maxSize), 0.3);
        this.lastUpdateTime = now;
        this.lastX = this.x;
        this.lastY = this.y;
    }

    display(p) {
        try {
            if (!p || typeof p.fill !== 'function' || typeof p.ellipse !== 'function' || typeof p.text !== 'function') {
                console.error('p5.js is not available');
                return;
            }
            if (!isFinite(this.x) || !isFinite(this.y) || !isFinite(this.size)) {
                console.error(`[Player ${this.id}] Invalid render data: x=${this.x}, y=${this.y}, size=${this.size}`);
                return;
            }
            p.fill(this.color[0], this.color[1], this.color[2]);
            p.ellipse(this.x, this.y, this.size, this.size);

            const BASE_TEXT_SIZE = 16;
            const SCALE_FACTOR = 0.05;
            const MAX_TEXT_SIZE = 32;
            const textSize = Math.min(BASE_TEXT_SIZE + this.size * SCALE_FACTOR, MAX_TEXT_SIZE);

            p.textAlign(p.CENTER);
            p.textSize(textSize);
            p.stroke(0);
            p.strokeWeight(3);
            p.fill(255);
            p.text(this.name, this.x, this.y - this.size / 2 - textSize * 0.6);
            p.noStroke();
        } catch (error) {
            console.error(`[Player ${this.id}] Error rendering player:`, error);
        }
    }
}
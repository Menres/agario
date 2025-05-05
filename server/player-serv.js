class Player {
    constructor(id, x, y, size) {
        if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number' || typeof size !== 'number' || size <= 0 || !isFinite(x) || !isFinite(y) || !isFinite(size)) {
            throw new Error('Invalid player parameters');
        }
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = size;
        this.name = `Player${id.slice(0, 4)}`;
        this.maxSize = 500;
        this.baseSpeed = 600;
        this.isPaused = false;
    }

    getSpeed() {
        return this.baseSpeed / Math.sqrt(this.size);
    }
}

module.exports = Player;
class Food {
    constructor(x, y, size, colorIndex, id) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof size !== 'number' || size <= 0 || !isFinite(x) || !isFinite(y) || !isFinite(size)) {
            throw new Error('Invalid food parameters');
        }
        this.x = x;
        this.y = y;
        this.size = size;
        this.colorIndex = colorIndex || 0;
        this.id = id || null;
    }
}

module.exports = Food;
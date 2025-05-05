class Food {
    constructor(x, y, size, colorIndex, id) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof size !== 'number' || size <= 0 || !isFinite(x) || !isFinite(y) || !isFinite(size)) {
            throw new Error('Invalid food parameters');
        }
        this.x = x;
        this.y = y;
        this.size = size;
        this.id = id || null;

        const colors = [
            [255, 87, 87],
            [87, 255, 87],
            [87, 87, 255],
            [255, 255, 87],
            [255, 87, 255],
            [87, 255, 255],
        ];
        this.color = colors[colorIndex % colors.length] || colors[0];
    }

    display(p) {
        try {
            if (!p || typeof p.noStroke !== 'function' || typeof p.fill !== 'function' || typeof p.ellipse !== 'function') {
                console.error('p5.js is not available');
                return;
            }
            p.noStroke();
            p.fill(this.color[0], this.color[1], this.color[2]);
            p.ellipse(this.x, this.y, this.size, this.size);
        } catch (error) {
            console.error('Error rendering food:', error);
        }
    }
}
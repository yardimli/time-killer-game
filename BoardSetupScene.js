// --- Scene 1: The Top Selector Bar ---
class BoardSetupScene extends Phaser.Scene {
	constructor() {
		super({ key: 'BoardSetupScene', active: true });
		this.currentSides = 3;
		this.hoveredIndex = -1;
		this.justClickedIndex = -1;
		this.PIXEL_SCALE = 2;
		this.SELECTOR_PIXEL_HEIGHT = 40;
		this.SELECTOR_SCREEN_HEIGHT = SELECTOR_SCREEN_HEIGHT; // From globals.js
		this.SLOT_PIXEL_WIDTH = 30;
		this.NUM_ICONS = 4;
		this.selectorHitArea = null;
		// --- MODIFICATION START ---
		// Define the master list of colors available for the balls.
		this.BALL_COLORS = [
			'#FF0000', // Red
			'#FFA500', // Orange
			'#FFFF00', // Yellow
			'#00FF00', // Green
			'#0000FF', // Blue
			'#4B0082', // Indigo
			'#EE82EE'  // Violet
		];
		// --- MODIFICATION END ---
	}

	create() {
		console.log("BoardSetupScene: create()");
		this.cameras.main.setViewport(0, 0, this.scale.width, this.SELECTOR_SCREEN_HEIGHT);
		this.selectorTexture = this.textures.createCanvas('selectorTexture', 1, this.SELECTOR_PIXEL_HEIGHT);
		this.selectorImage = this.add.image(0, 0, 'selectorTexture')
			.setOrigin(0, 0)
			.setScale(this.PIXEL_SCALE);

		this.selectorHitArea = new Phaser.Geom.Rectangle(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		this.selectorImage.setInteractive(this.selectorHitArea, Phaser.Geom.Rectangle.Contains);

		this.selectorImage.on('pointermove', this.handlePointerMove, this);
		this.selectorImage.on('pointerout', this.handlePointerOut, this);
		this.selectorImage.on('pointerdown', this.handlePointerDown, this);
		this.game.events.on('toggleMapView', (isMapView) => {
			this.cameras.main.setVisible(!isMapView);
		}, this);
		this.scale.on('resize', this.handleResize, this);
		this.handleResize(this.scale.gameSize);
		// --- MODIFICATION START ---
		// Emit the initial board configuration with sides and colors.
		this.emitBoardConfiguration();
		// --- MODIFICATION END ---
	}

	handleResize(gameSize) {
		this.cameras.main.setViewport(0, 0, gameSize.width, this.SELECTOR_SCREEN_HEIGHT);
		const newWidth = gameSize.width / this.PIXEL_SCALE;
		const newHeight = this.SELECTOR_PIXEL_HEIGHT;
		this.selectorTexture.setSize(newWidth, newHeight);
		this.selectorHitArea.setSize(newWidth, newHeight);
		this.selectorImage.setPosition(this.cameras.main.x, this.cameras.main.y);
		this.drawSelectorBar();
	}

	getIconIndexFromPointer(pointer) {
		const totalIconsWidth = this.NUM_ICONS * this.SLOT_PIXEL_WIDTH;
		const startX = (this.selectorTexture.width - totalIconsWidth) / 2;
		const localX = (pointer.x - this.selectorImage.x) / this.PIXEL_SCALE;
		if (localX < startX || localX > startX + totalIconsWidth) {
			return -1;
		}
		return Math.floor((localX - startX) / this.SLOT_PIXEL_WIDTH);
	}

	handlePointerMove(pointer) {
		const newIndex = this.getIconIndexFromPointer(pointer);
		if (newIndex !== this.hoveredIndex) {
			this.hoveredIndex = newIndex;
			this.drawSelectorBar();
		}
	}

	handlePointerOut() {
		if (this.hoveredIndex !== -1) {
			this.hoveredIndex = -1;
			this.drawSelectorBar();
		}
	}

	handlePointerDown(pointer) {
		const index = this.getIconIndexFromPointer(pointer);
		if (index !== -1) {
			const newSides = index + 3;
			this.currentSides = newSides;
			this.justClickedIndex = index;
			this.drawSelectorBar();
			// --- MODIFICATION START ---
			// Emit an event with the new number of sides and a unique set of colors.
			this.emitBoardConfiguration();
			// --- MODIFICATION END ---
			this.time.delayedCall(100, () => {
				this.justClickedIndex = -1;
				this.drawSelectorBar();
			});
		}
	}

	// --- NEW METHOD START ---
	/**
	 * Generates a unique set of colors based on the current number of sides
	 * and emits an event to other scenes.
	 */
	emitBoardConfiguration() {
		// Shuffle the master color list to get a random order.
		const shuffledColors = Phaser.Utils.Array.Shuffle([...this.BALL_COLORS]);
		// Select the number of colors needed for the current shape.
		const selectedColors = shuffledColors.slice(0, this.currentSides);

		// Emit a global event with the new configuration object.
		this.game.events.emit('boardConfigurationChanged', {
			sides: this.currentSides,
			colors: selectedColors
		});
	}
	// --- NEW METHOD END ---

	drawSelectorBar() {
		const ctx = this.selectorTexture.getContext();
		ctx.clearRect(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		const iconSize = 10;
		const totalIconsWidth = this.NUM_ICONS * this.SLOT_PIXEL_WIDTH;
		const startX = Math.floor((this.selectorTexture.width - totalIconsWidth) / 2);

		for (let i = 0; i < this.NUM_ICONS; i++) {
			const sides = i + 3;
			const cx = startX + i * this.SLOT_PIXEL_WIDTH + (this.SLOT_PIXEL_WIDTH / 2);
			const cy = this.SELECTOR_PIXEL_HEIGHT / 2;
			const isSelected = (sides === this.currentSides);
			const isHovered = (i === this.hoveredIndex);
			const isClicked = (i === this.justClickedIndex);

			ctx.fillStyle = '#000';
			ctx.strokeStyle = isSelected ? '#FFFFFF' : '#00FFFF';
			if (isHovered) ctx.strokeStyle = '#FFFF00';
			if (isClicked) ctx.fillStyle = '#FFFFFF';
			this.drawPixelRect(ctx, cx - 12, cy - 15, 24, 30, isSelected ? 2 : 1);

			let polyX = cx;
			let polyY = cy;
			if (isHovered && !isClicked) {
				polyX += Phaser.Math.Between(-1, 1);
				polyY += Phaser.Math.Between(-1, 1);
			}
			ctx.fillStyle = isClicked ? '#000000' : '#FFFFFF';
			this.drawPixelPolygon(ctx, polyX, polyY, iconSize, sides);
		}
		this.selectorTexture.update();
	}

	drawPixelRect(ctx, x, y, w, h, lineWidth = 1) {
		ctx.lineWidth = lineWidth;
		ctx.fillRect(x, y, w, h);
		ctx.strokeRect(x, y, w, h);
	}

	drawPixelPolygon(ctx, cx, cy, radius, sides) {
		const points = [];
		for (let i = 0; i < sides; i++) {
			const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
			points.push({ x: Math.round(cx + radius * Math.cos(angle)), y: Math.round(cy + radius * Math.sin(angle)) });
		}
		for (let i = 0; i < sides; i++) {
			const p1 = points[i];
			const p2 = points[(i + 1) % sides];
			this.drawPixelLine(ctx, p1.x, p1.y, p2.x, p2.y);
		}
	}

	drawPixelLine(ctx, x0, y0, x1, y1) {
		const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		while (true) {
			ctx.fillRect(x0, y0, 1, 1);
			if (x0 === x1 && y0 === y1) break;
			let e2 = 2 * err;
			if (e2 >= dy) { err += dy; x0 += sx; }
			if (e2 <= dx) { err += dx; y0 += sy; }
		}
	}
}
// --- Scene 1: The Top Selector Bar ---
class BoardSetupScene extends Phaser.Scene {
	constructor() {
		super({ key: 'BoardSetupScene', active: true });
		this.currentSides = 3;
		this.hoveredIndex = -1;
		this.justClickedIndex = -1;
		
		// --- Configuration updated for vertical layout ---
		this.PIXEL_SCALE = GAME_CONFIG.Shared.PIXEL_SCALE;
		// The width of the selector bar in screen pixels.
		this.SELECTOR_SCREEN_WIDTH = GAME_CONFIG.Shared.SELECTOR_SCREEN_WIDTH;
		// The width of the selector bar's internal canvas in its own pixels.
		this.SELECTOR_PIXEL_WIDTH = GAME_CONFIG.BoardSetupScene.SELECTOR_PIXEL_WIDTH;
		// The height of each icon slot in its own pixels.
		this.SLOT_PIXEL_HEIGHT = GAME_CONFIG.BoardSetupScene.SLOT_PIXEL_HEIGHT;
		this.NUM_ICONS = GAME_CONFIG.BoardSetupScene.NUM_ICONS;
		this.BALL_COLORS = GAME_CONFIG.Shared.BALL_COLORS;
		
		this.selectorHitArea = null;
	}
	
	create() {
		console.log("BoardSetupScene: create()");
		// --- Viewport set to the left side of the screen ---
		this.cameras.main.setViewport(0, 0, this.SELECTOR_SCREEN_WIDTH, this.scale.height);
		// The texture is now tall and thin. Its height will be set dynamically in handleResize.
		this.selectorTexture = this.textures.createCanvas('selectorTexture', this.SELECTOR_PIXEL_WIDTH, 1);
		
		this.selectorImage = this.add.image(0, 0, 'selectorTexture')
			.setOrigin(0, 0)
			.setScale(this.PIXEL_SCALE);
		
		this.selectorHitArea = new Phaser.Geom.Rectangle(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		this.selectorImage.setInteractive(this.selectorHitArea, Phaser.Geom.Rectangle.Contains);
		
		this.selectorImage.on('pointermove', this.handlePointerMove, this);
		this.selectorImage.on('pointerout', this.handlePointerOut, this);
		this.selectorImage.on('pointerdown', this.handlePointerDown, this);
		this.scale.on('resize', this.handleResize, this);
		this.handleResize(this.scale.gameSize);
		this.emitBoardConfiguration();
	}
	
	handleResize(gameSize) {
		// --- Viewport and texture resized for a vertical bar ---
		this.cameras.main.setViewport(0, 0, this.SELECTOR_SCREEN_WIDTH, gameSize.height);
		const newWidth = this.SELECTOR_PIXEL_WIDTH;
		const newHeight = gameSize.height / this.PIXEL_SCALE;
		this.selectorTexture.setSize(newWidth, newHeight);
		this.selectorHitArea.setSize(newWidth, newHeight);
		this.selectorImage.setPosition(this.cameras.main.x, this.cameras.main.y);
		this.drawSelectorBar();
	}
	
	getIconIndexFromPointer(pointer) {
		const totalIconsHeight = this.NUM_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = (this.selectorTexture.height - totalIconsHeight) / 2;
		const localY = (pointer.y - this.selectorImage.y) / this.PIXEL_SCALE;
		
		if (localY < startY || localY > startY + totalIconsHeight) {
			return -1;
		}
		return Math.floor((localY - startY) / this.SLOT_PIXEL_HEIGHT);
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
			this.emitBoardConfiguration();
			this.time.delayedCall(100, () => {
				this.justClickedIndex = -1;
				this.drawSelectorBar();
			});
		}
	}
	
	/**
	 * Generates a unique set of colors based on the current number of sides,
	 * assigns them to goals, and emits an event to other scenes.
	 */
	emitBoardConfiguration() {
		// The master list of colors is now sourced from the centralized config file.
		const shuffledColors = Phaser.Utils.Array.Shuffle([...this.BALL_COLORS]);
		const selectedColors = shuffledColors.slice(0, this.currentSides);
		
		// Create a mapping of each side (goal) to a specific color.
		const goals = [];
		for (let i = 0; i < this.currentSides; i++) {
			goals.push({
				side: i,
				color: selectedColors[i]
			});
		}
		
		this.game.events.emit('boardConfigurationChanged', {
			sides: this.currentSides,
			colors: selectedColors,
			goals: goals // Add the new goals array to the event payload
		});
	}
	
	drawSelectorBar() {
		const ctx = this.selectorTexture.getContext();
		ctx.clearRect(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		const iconSize = 10;
		// --- Drawing logic updated for a vertical column ---
		const totalIconsHeight = this.NUM_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = Math.floor((this.selectorTexture.height - totalIconsHeight) / 2);
		
		for (let i = 0; i < this.NUM_ICONS; i++) {
			const sides = i + 3;
			// Center X is now fixed for the vertical bar.
			const cx = this.SELECTOR_PIXEL_WIDTH / 2;
			// Y position changes for each icon, creating a column.
			const cy = startY + i * this.SLOT_PIXEL_HEIGHT + (this.SLOT_PIXEL_HEIGHT / 2);
			const isSelected = (sides === this.currentSides);
			const isHovered = (i === this.hoveredIndex);
			const isClicked = (i === this.justClickedIndex);
			
			ctx.fillStyle = '#000';
			ctx.strokeStyle = isSelected ? '#FFFFFF' : '#00FFFF';
			if (isHovered) ctx.strokeStyle = '#FFFF00';
			if (isClicked) ctx.fillStyle = '#FFFFFF';
			// The rectangle is now taller than it is wide.
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

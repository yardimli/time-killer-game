class BoardSetup {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		this.currentSides = 3;
		this.hoveredIndex = -1;
		this.justClickedIndex = -1;
		
		this.PIXEL_SCALE = GAME_CONFIG.Shared.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = GAME_CONFIG.Shared.SELECTOR_SCREEN_WIDTH;
		this.SELECTOR_PIXEL_WIDTH = GAME_CONFIG.BoardSetupScene.SELECTOR_PIXEL_WIDTH;
		this.SLOT_PIXEL_HEIGHT = GAME_CONFIG.BoardSetupScene.SLOT_PIXEL_HEIGHT;
		this.NUM_ICONS = GAME_CONFIG.BoardSetupScene.NUM_ICONS;
		this.BALL_COLORS = GAME_CONFIG.Shared.BALL_COLORS;
		
		this.selectorHitArea = null;
	}
	
	init() {
		console.log('BoardSetup: init()');
		
		this.selectorTexture = this.scene.textures.createCanvas('selectorTexture', this.SELECTOR_PIXEL_WIDTH, 1);
		
		this.selectorImage = this.scene.add.image(0, 0, 'selectorTexture')
			.setOrigin(0, 0)
			.setScale(this.PIXEL_SCALE);
		
		this.selectorHitArea = new Phaser.Geom.Rectangle(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		this.selectorImage.setInteractive(this.selectorHitArea, Phaser.Geom.Rectangle.Contains);
		
		this.selectorImage.on('pointermove', this.handlePointerMove, this);
		this.selectorImage.on('pointerout', this.handlePointerOut, this);
		this.selectorImage.on('pointerdown', this.handlePointerDown, this);
	}
	
	handleResize(gameSize) {
		// This check prevents an error if handleResize is called before init.
		if (!this.selectorTexture) {
			return;
		}
		
		const newWidth = this.SELECTOR_PIXEL_WIDTH;
		const newHeight = gameSize.height / this.PIXEL_SCALE;
		this.selectorTexture.setSize(newWidth, newHeight);
		this.selectorHitArea.setSize(newWidth, newHeight);
		this.selectorImage.setPosition(0, 0);
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
			this.scene.time.delayedCall(100, () => {
				this.justClickedIndex = -1;
				this.drawSelectorBar();
			});
		}
	}
	
	emitBoardConfiguration() {
		const shuffledColors = Phaser.Utils.Array.Shuffle([...this.BALL_COLORS]);
		const selectedColors = shuffledColors.slice(0, this.currentSides);
		
		const goals = [];
		for (let i = 0; i < this.currentSides; i++) {
			goals.push({
				side: i,
				color: selectedColors[i]
			});
		}
		
		this.scene.game.events.emit('boardConfigurationChanged', {
			sides: this.currentSides,
			colors: selectedColors,
			goals: goals
		});
	}
	
	drawSelectorBar() {
		const ctx = this.selectorTexture.getContext();
		ctx.clearRect(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		const iconSize = 10;
		const totalIconsHeight = this.NUM_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = Math.floor((this.selectorTexture.height - totalIconsHeight) / 2);
		
		for (let i = 0; i < this.NUM_ICONS; i++) {
			const sides = i + 3;
			const cx = this.SELECTOR_PIXEL_WIDTH / 2;
			const cy = startY + i * this.SLOT_PIXEL_HEIGHT + (this.SLOT_PIXEL_HEIGHT / 2);
			const isSelected = (sides === this.currentSides);
			const isHovered = (i === this.hoveredIndex);
			const isClicked = (i === this.justClickedIndex);
			
			ctx.fillStyle = isClicked ? '#FFFFFF' : '#000';
			ctx.strokeStyle = isSelected ? '#FFFFFF' : '#00FFFF';
			if (isHovered) ctx.strokeStyle = '#FFFF00';
			this.drawPixelRect(ctx, cx - 12, cy - 15, 24, 30, isSelected ? 2 : 1);
			
			let polyX = cx;
			let polyY = cy;
			if (isHovered && !isClicked) {
				polyX += Phaser.Math.Between(-1, 1);
				polyY += Phaser.Math.Between(-1, 1);
			}
			
			ctx.strokeStyle = isClicked ? '#000000' : '#FFFFFF';
			ctx.lineWidth = 1;
			this.drawPolygon(ctx, polyX, polyY, iconSize, sides);
		}
		this.selectorTexture.update();
	}
	
	drawPixelRect(ctx, x, y, w, h, lineWidth = 1) {
		ctx.lineWidth = lineWidth;
		ctx.fillRect(x, y, w, h);
		ctx.strokeRect(x, y, w, h);
	}
	
	drawPolygon(ctx, cx, cy, radius, sides) {
		const points = [];
		for (let i = 0; i < sides; i++) {
			const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
			points.push({ x: Math.round(cx + radius * Math.cos(angle)), y: Math.round(cy + radius * Math.sin(angle)) });
		}
		
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		ctx.closePath();
		ctx.stroke();
	}
}

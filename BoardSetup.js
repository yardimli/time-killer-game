class BoardSetup {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		this.currentSides = 3;
		this.currentBoardType = 'polygon'; // 'polygon' or 'rectangle'
		this.hoveredType = '';
		this.hoveredIndex = -1;
		this.justClickedIndex = -1;
		this.justClickedType = '';
		
		this.PIXEL_SCALE = GAME_CONFIG.Shared.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = GAME_CONFIG.Shared.SELECTOR_SCREEN_WIDTH;
		this.SELECTOR_PIXEL_WIDTH = GAME_CONFIG.BoardSetupScene.SELECTOR_PIXEL_WIDTH;
		this.SLOT_PIXEL_HEIGHT = GAME_CONFIG.BoardSetupScene.SLOT_PIXEL_HEIGHT;
		this.NUM_ICONS = GAME_CONFIG.BoardSetupScene.NUM_ICONS;
		this.NUM_RECT_ICONS = GAME_CONFIG.BoardSetupScene.NUM_RECT_ICONS;
		this.BALL_COLORS = GAME_CONFIG.Shared.BALL_COLORS;
		
		this.selectorHitArea = null;
		
		// --- NEW: Timer properties ---
		this.timerText = null;
		this.gameTimer = null;
		this.elapsedSeconds = 0;
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
		
		// --- NEW: Create the timer text object ---
		const textStyle = { font: '24px monospace', fill: '#FFFFFF', align: 'center' };
		this.timerText = this.scene.add.text(0, 0, '00:00', textStyle)
			.setOrigin(0.5)
			.setStroke('#000000', 4);
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
		
		// --- NEW: Position the timer text on resize ---
		if (this.timerText) {
			// Position it at the bottom of the selector bar area.
			this.timerText.setPosition(this.SELECTOR_SCREEN_WIDTH / 2, gameSize.height - 30);
		}
	}
	
	// Updated to handle both polygon and rectangle icon sections.
	getIconInfoFromPointer(pointer) {
		const totalPolyIconsHeight = this.NUM_ICONS * this.SLOT_PIXEL_HEIGHT;
		const totalRectIconsHeight = this.NUM_RECT_ICONS * this.SLOT_PIXEL_HEIGHT;
		const totalHeight = totalPolyIconsHeight + totalRectIconsHeight + this.SLOT_PIXEL_HEIGHT; // Add padding between sections
		
		const startY = (this.selectorTexture.height - totalHeight) / 2;
		const localY = (pointer.y - this.selectorImage.y) / this.PIXEL_SCALE;
		
		// Check if pointer is in the polygon section
		if (localY >= startY && localY < startY + totalPolyIconsHeight) {
			return {
				type: 'polygon',
				index: Math.floor((localY - startY) / this.SLOT_PIXEL_HEIGHT)
			};
		}
		
		// Check if pointer is in the rectangle section
		const rectStartY = startY + totalPolyIconsHeight + this.SLOT_PIXEL_HEIGHT;
		if (localY >= rectStartY && localY < rectStartY + totalRectIconsHeight) {
			return {
				type: 'rectangle',
				index: Math.floor((localY - rectStartY) / this.SLOT_PIXEL_HEIGHT)
			};
		}
		
		return { type: '', index: -1 }; // Not over any icon
	}
	
	handlePointerMove(pointer) {
		const { type, index } = this.getIconInfoFromPointer(pointer);
		if (type !== this.hoveredType || index !== this.hoveredIndex) {
			this.hoveredType = type;
			this.hoveredIndex = index;
			this.drawSelectorBar();
		}
	}
	
	handlePointerOut() {
		if (this.hoveredIndex !== -1) {
			this.hoveredIndex = -1;
			this.hoveredType = '';
			this.drawSelectorBar();
		}
	}
	
	handlePointerDown(pointer) {
		const { type, index } = this.getIconInfoFromPointer(pointer);
		if (index !== -1) {
			this.currentBoardType = type;
			if (type === 'polygon') {
				this.currentSides = index + 3; // 3, 4, 5, 6 sides
			} else if (type === 'rectangle') {
				this.currentSides = index + 2; // 2, 3, 4, 5, 6 goals
			}
			
			this.justClickedType = type;
			this.justClickedIndex = index;
			
			this.drawSelectorBar();
			this.emitBoardConfiguration();
			
			this.scene.time.delayedCall(100, () => {
				this.justClickedIndex = -1;
				this.justClickedType = '';
				this.drawSelectorBar();
			});
		}
	}
	
	emitBoardConfiguration() {
		// --- MODIFIED: Start the timer when the board configuration is set/changed ---
		this.startTimer();
		
		// Dynamically calculate the total max score based on the number of sides.
		// Each side/goal contributes to the total possible score.
		const newTotalMaxScore = this.currentSides * GAME_CONFIG.ScoreScenes.INDIVIDUAL_MAX_SCORE;
		GAME_CONFIG.ScoreScenes.TOTAL_MAX_SCORE = newTotalMaxScore;
		GAME_CONFIG.Shared.NUMBER_OF_SIDES = this.currentSides;
		
		const shuffledColors = Phaser.Utils.Array.Shuffle([...this.BALL_COLORS]);
		const selectedColors = shuffledColors.slice(0, this.currentSides);
		
		const goals = [];
		for (let i = 0; i < this.currentSides; i++) {
			goals.push({
				side: i,
				color: selectedColors[i]
			});
		}
		
		// Emit the board type along with other configuration details.
		this.scene.game.events.emit('boardConfigurationChanged', {
			sides: this.currentSides,
			colors: selectedColors,
			goals: goals,
			boardType: this.currentBoardType
		});
	}
	
	drawSelectorBar() {
		const ctx = this.selectorTexture.getContext();
		ctx.clearRect(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		const iconSize = 10;
		
		// Calculate starting position to center both icon groups.
		const totalPolyIconsHeight = this.NUM_ICONS * this.SLOT_PIXEL_HEIGHT;
		const totalRectIconsHeight = this.NUM_RECT_ICONS * this.SLOT_PIXEL_HEIGHT;
		const paddingBetweenGroups = this.SLOT_PIXEL_HEIGHT; // One slot height for padding
		const totalContentHeight = totalPolyIconsHeight + totalRectIconsHeight + paddingBetweenGroups;
		const startY = Math.floor((this.selectorTexture.height - totalContentHeight) / 2);
		
		// --- Draw Polygon Icons ---
		for (let i = 0; i < this.NUM_ICONS; i++) {
			const sides = i + 3;
			const cx = this.SELECTOR_PIXEL_WIDTH / 2;
			const cy = startY + i * this.SLOT_PIXEL_HEIGHT + (this.SLOT_PIXEL_HEIGHT / 2);
			
			const isSelected = (this.currentBoardType === 'polygon' && sides === this.currentSides);
			const isHovered = (this.hoveredType === 'polygon' && i === this.hoveredIndex);
			const isClicked = (this.justClickedType === 'polygon' && i === this.justClickedIndex);
			
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
		
		// --- Draw Rectangle (Number) Icons ---
		const rectStartY = startY + totalPolyIconsHeight + paddingBetweenGroups;
		ctx.font = '12px monospace'; // Font for drawing numbers
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		
		for (let i = 0; i < this.NUM_RECT_ICONS; i++) {
			const numGoals = i + 2;
			const cx = this.SELECTOR_PIXEL_WIDTH / 2;
			const cy = rectStartY + i * this.SLOT_PIXEL_HEIGHT + (this.SLOT_PIXEL_HEIGHT / 2);
			
			const isSelected = (this.currentBoardType === 'rectangle' && numGoals === this.currentSides);
			const isHovered = (this.hoveredType === 'rectangle' && i === this.hoveredIndex);
			const isClicked = (this.justClickedType === 'rectangle' && i === this.justClickedIndex);
			
			ctx.fillStyle = isClicked ? '#FFFFFF' : '#000';
			ctx.strokeStyle = isSelected ? '#FFFFFF' : '#00FFFF';
			if (isHovered) ctx.strokeStyle = '#FFFF00';
			this.drawPixelRect(ctx, cx - 12, cy - 15, 24, 30, isSelected ? 2 : 1);
			
			ctx.fillStyle = isClicked ? '#000000' : '#FFFFFF';
			let textX = cx;
			let textY = cy;
			if (isHovered && !isClicked) {
				textX += Phaser.Math.Between(-1, 1);
				textY += Phaser.Math.Between(-1, 1);
			}
			ctx.fillText(numGoals.toString(), textX, textY);
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
	
	// --- NEW: Methods to manage the game timer ---
	
	/**
	 * Starts or restarts the game timer.
	 */
	startTimer() {
		// Stop any existing timer.
		if (this.gameTimer) {
			this.gameTimer.remove();
		}
		
		this.elapsedSeconds = 0;
		this.updateTimerText(); // Display '00:00' immediately.
		
		// Create a new looping timer event that fires every second.
		this.gameTimer = this.scene.time.addEvent({
			delay: 1000,
			callback: () => {
				this.elapsedSeconds++;
				this.updateTimerText();
			},
			callbackScope: this,
			loop: true
		});
	}
	
	/**
	 * Updates the timer text display with the current elapsed time.
	 */
	updateTimerText() {
		if (!this.timerText) return;
		
		const minutes = Math.floor(this.elapsedSeconds / 60);
		const seconds = this.elapsedSeconds % 60;
		
		// Format the time to always have two digits (e.g., 01:05).
		const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		
		this.timerText.setText(formattedTime);
	}
}

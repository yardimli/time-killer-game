class TopScore {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		
		// --- UI element references ---
		this.totalProgressBar = null;
		this.totalProgressContainer = null; // New container for progress rects.
		this.totalProgressRectangles = []; // New array for progress rects.
		this.totalPercentageText = null;
		this.userNameText = null;
		this.percentageTween = null; // New reference for text tween.
		this.currentPercentage = 0; // New tracker for current percentage.
		this.lastRectanglesShown = 0; // NEW: Track visible rectangles to calculate animation delay correctly.
		
		// --- NEW: Flag to ensure the 'gameOver' event is only fired once per game. ---
		this.gameOverTriggered = false;
		
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.TOTAL_MAX_SCORE = scoreScenesConfig.TOTAL_MAX_SCORE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
		// --- MODIFIED: Added reference to the new right score bar width ---
		this.RIGHT_SCORE_SCREEN_WIDTH = sharedConfig.RIGHT_SCORE_SCREEN_WIDTH;
		
		// --- Configuration for progress bar rectangles, similar to BottomScore ---
		this.PROGRESS_RECT_WIDTH = 3; // Width of each progress rectangle.
		this.PROGRESS_RECT_PADDING = 2; // Padding between rectangles.
		this.PROGRESS_ANIMATION_DELAY = 50; // Delay between each rectangle animation in ms (faster for total).
	}
	
	init() {
		console.log('TopScore: init()');
		
		// UI is now created dynamically in drawScoreboard, called by handleBoardChange.
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.scene.game.events.on('scorePoint', this.addScore, this);
		
		// --- NEW: Listen for changes to the max score configuration. ---
		this.scene.game.events.on('maxScoreChanged', this.handleMaxScoreChange, this);
	}
	
	// --- NEW: Handler for when the max score is changed via keyboard input. ---
	handleMaxScoreChange() {
		// Update the internal max score value from the global config.
		this.TOTAL_MAX_SCORE = GAME_CONFIG.ScoreScenes.TOTAL_MAX_SCORE;
		// Update the progress bar to reflect the new maximum.
		this.updateTotalScoreBar();
	}
	
	handleBoardChange(config) {
		this.scoreConfig.colors = config.colors;
		this.scoreConfig.goals = config.goals;
		this.scores = {};
		this.scoreConfig.colors.forEach(color => {
			this.scores[color] = 0;
		});
		
		this.TOTAL_MAX_SCORE = GAME_CONFIG.ScoreScenes.TOTAL_MAX_SCORE;
		
		// --- NEW: Reset the game over flag for the new game. ---
		this.gameOverTriggered = false;
		
		// Re-create the UI for the new configuration or on initial load.
		this.drawScoreboard();
		// Update the bar to its initial state (0%).
		this.updateTotalScoreBar();
	}
	
	addScore(data) {
		const color = data.color;
		if (this.scores[color] !== undefined) {
			this.scores[color]++;
			// Only update the visual display, don't redraw everything.
			this.updateTotalScoreBar();
		}
	}
	
	/**
	 * This method now creates all UI elements from scratch.
	 * It's called on initialization and resize to ensure correct layout.
	 */
	drawScoreboard() {
		// --- Clean up any old UI elements before redrawing. ---
		if (this.totalProgressBar) this.totalProgressBar.destroy();
		if (this.totalProgressContainer) this.totalProgressContainer.destroy();
		if (this.totalPercentageText) this.totalPercentageText.destroy();
		if (this.userNameText) this.userNameText.destroy();
		this.totalProgressRectangles = [];
		if (this.percentageTween) this.percentageTween.stop();
		this.lastRectanglesShown = 0; // NEW: Reset the counter when redrawing the board.
		
		if (this.scoreConfig.goals.length === 0) {
			return; // Don't draw if there are no goals.
		}
		
		const areaX = this.SELECTOR_SCREEN_WIDTH;
		const areaY = 0;
		// --- MODIFIED: The available width is reduced by the new right score bar. ---
		const areaWidth = this.scene.scale.width - areaX - this.RIGHT_SCORE_SCREEN_WIDTH;
		const areaHeight = this.TOP_SCORE_SCREEN_HEIGHT;
		
		const barHeight = areaHeight * 0.8;
		const barY = areaY + areaHeight / 2;
		const barWidth = areaWidth * 0.9;
		const barX = areaX + (areaWidth - barWidth) / 2;
		
		// --- Create UI elements similar to BottomScore. ---
		// The main bar background.
		this.totalProgressBar = this.scene.add.rectangle(barX + barWidth / 2, barY, barWidth, barHeight, 0x111111)
			.setStrokeStyle(2, 0xFFFFFF);
		
		// Container for progress rectangles.
		this.totalProgressContainer = this.scene.add.container(barX + barWidth / 2, barY);
		
		// Calculate how many rectangles we can fit.
		const availableWidth = barWidth - (2 * this.PROGRESS_RECT_PADDING);
		const rectTotalWidth = this.PROGRESS_RECT_WIDTH + this.PROGRESS_RECT_PADDING;
		const maxRectangles = Math.floor(availableWidth / rectTotalWidth);
		this.maxRectangles = maxRectangles; // Store for update logic.
		
		// The starting X position is now on the right side of the bar.
		const startRectX = barWidth / 2 - this.PROGRESS_RECT_PADDING - (this.PROGRESS_RECT_WIDTH / 2);
		for (let i = 0; i < maxRectangles; i++) {
			// We subtract from the starting position to place subsequent rectangles to the left.
			const rectX = startRectX - (i * rectTotalWidth);
			const rect = this.scene.add.rectangle(
				rectX,
				0,
				this.PROGRESS_RECT_WIDTH,
				barHeight - 8, // Slightly smaller than bar height.
				0xDDDDDD // A neutral light grey color for the total bar.
			);
			rect.setScale(0, 1); // Start with 0 width for animation.
			rect.setAlpha(0);
			this.totalProgressContainer.add(rect);
			this.totalProgressRectangles.push(rect); // The array is now ordered right-to-left.
		}
		
		// Create username text.
		this.userNameText = this.scene.add.text(barX + 100, barY, 'Ege', {
			font: '28px monospace',
			fill: '#FFFFFF',
			stroke: '#000000',
			strokeThickness: 4,
			align: 'center'
		}).setOrigin(0.5);
		
		// Create the percentage text.
		this.totalPercentageText = this.scene.add.text(barX + barWidth - 300, barY, '0% Complete', {
			font: '28px monospace',
			fill: '#000000',
			stroke: '#FFFFFF',
			strokeThickness: 4,
			align: 'center'
		}).setOrigin(0.5);
		
		// Reset animation state trackers.
		this.currentPercentage = 0;
		this.percentageTween = null;
	}
	
	/**
	 * --- This method handles score updates and animations. ---
	 * It animates the percentage text and the progress bar rectangles.
	 */
	updateTotalScoreBar() {
		if (!this.totalProgressRectangles || this.totalProgressRectangles.length === 0) {
			return; // UI not ready.
		}
		
		const totalScore = Object.values(this.scores).reduce((sum, score) => sum + score, 0);
		const targetPercentage = this.TOTAL_MAX_SCORE > 0
			? Math.floor((totalScore / this.TOTAL_MAX_SCORE) * 100)
			: 0;
		
		// Animate percentage counter.
		if (this.percentageTween) {
			this.percentageTween.stop();
		}
		
		this.percentageTween = this.scene.tweens.addCounter({
			from: this.currentPercentage,
			to: targetPercentage,
			duration: Math.abs(targetPercentage - this.currentPercentage) * 50, // 50ms per percentage point.
			ease: 'Linear',
			onUpdate: (tween) => {
				const value = Math.floor(tween.getValue());
				if (this.totalPercentageText) {
					this.totalPercentageText.setText(`${value}% Complete`);
				}
			},
			onComplete: () => {
				this.currentPercentage = targetPercentage;
			}
		});
		
		// Calculate how many rectangles should be visible.
		const rectanglesToShow = Math.floor((targetPercentage / 100) * this.maxRectangles);
		
		// Animate rectangles. Because the array is now ordered right-to-left,
		// this loop will animate the fill from right to left automatically.
		this.totalProgressRectangles.forEach((rect, index) => {
			if (index < rectanglesToShow) {
				// Animate this rectangle appearing if it's not already visible.
				if (rect.scaleX === 0) {
					// MODIFIED: Calculate delay relative to the last visible rectangle.
					// This ensures that when a new point is scored, the animation for the
					// new rectangle(s) starts immediately, instead of being delayed by
					// all the previously visible rectangles.
					const delayIndex = index - this.lastRectanglesShown;
					
					this.scene.tweens.add({
						targets: rect,
						scaleX: 1,
						alpha: 1,
						duration: 200,
						ease: 'Back.easeOut',
						delay: Math.max(0, delayIndex) * this.PROGRESS_ANIMATION_DELAY
					});
				}
			} else {
				// Hide rectangles that should not be visible.
				if (rect.scaleX > 0) {
					this.scene.tweens.add({
						targets: rect,
						scaleX: 0,
						alpha: 0,
						duration: 150,
						ease: 'Cubic.easeIn'
					});
				}
			}
		});
		
		// NEW: Update the count of visible rectangles for the next score update.
		this.lastRectanglesShown = rectanglesToShow;
		
		// --- MODIFIED: Check for game over condition and emit event. ---
		if (targetPercentage >= 100 && !this.gameOverTriggered) {
			this.gameOverTriggered = true;
			this.scene.game.events.emit('gameOver');
			console.log('Game Over event emitted!');
		}
	}
	
	handleResize(gameSize) {
		this.drawScoreboard();
		// --- After redrawing, update the bar to reflect the current score. ---
		// This will now correctly animate from 0 to current score because
		// drawScoreboard resets lastRectanglesShown to 0.
		this.updateTotalScoreBar();
	}
}

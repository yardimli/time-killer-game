/**
 * @file Manages the vertical score bar on the right, displaying drop accuracy.
 */
class RightScore {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		
		// --- Score Tracking ---
		this.correctDrops = 0;
		this.incorrectDrops = 0;
		
		// --- UI element references ---
		this.progressBar = null;
		this.progressContainer = null;
		this.progressRectangles = [];
		this.percentageText = null;
		this.titleText = null;
		this.percentageTween = null;
		this.currentPercentage = 0;
		this.lastRectanglesShown = 0;
		this.maxRectangles = 0;
		
		// --- Configuration ---
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.RIGHT_SCORE_SCREEN_WIDTH = sharedConfig.RIGHT_SCORE_SCREEN_WIDTH;
		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.BOTTOM_SCORE_SCREEN_HEIGHT = scoreScenesConfig.BOTTOM_SCORE_SCREEN_HEIGHT;
		
		this.PROGRESS_RECT_HEIGHT = 3; // Height (thickness) of each progress rectangle.
		this.PROGRESS_RECT_PADDING = 2; // Padding between rectangles.
		this.PROGRESS_ANIMATION_DELAY = 25; // Delay between each rectangle animation in ms.
	}
	
	init() {
		console.log('RightScore: init()');
		
		// Reset on board change.
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		
		// Listen for drop events to update the score.
		this.scene.game.events.on('correctDrop', () => {
			this.correctDrops++;
			this.updateScoreBar();
		}, this);
		this.scene.game.events.on('incorrectDrop', () => {
			this.incorrectDrops++;
			this.updateScoreBar();
		}, this);
	}
	
	handleBoardChange(config) {
		// Reset counters for the new board.
		this.correctDrops = 0;
		this.incorrectDrops = 0;
		
		// Redraw the UI from scratch.
		this.drawScoreboard();
		// Update the bar to its initial state (0%).
		this.updateScoreBar();
	}
	
	drawScoreboard() {
		// --- Clean up any old UI elements before redrawing. ---
		if (this.progressBar) this.progressBar.destroy();
		if (this.progressContainer) this.progressContainer.destroy();
		if (this.percentageText) this.percentageText.destroy();
		if (this.titleText) this.titleText.destroy();
		this.progressRectangles = [];
		if (this.percentageTween) this.percentageTween.stop();
		this.lastRectanglesShown = 0;
		
		// --- Calculate the drawing area for the vertical bar ---
		const areaX = this.scene.scale.width - this.RIGHT_SCORE_SCREEN_WIDTH;
		const areaY = this.TOP_SCORE_SCREEN_HEIGHT;
		const areaWidth = this.RIGHT_SCORE_SCREEN_WIDTH;
		const areaHeight = this.scene.scale.height - this.TOP_SCORE_SCREEN_HEIGHT - this.BOTTOM_SCORE_SCREEN_HEIGHT;
		
		const barWidth = areaWidth * 0.6;
		const barHeight = areaHeight * 0.9;
		const barX = areaX + areaWidth / 2;
		const barY = areaY + areaHeight / 2;
		
		// --- Create UI elements ---
		// The main bar background.
		this.progressBar = this.scene.add.rectangle(barX, barY, barWidth, barHeight, 0x111111)
			.setStrokeStyle(2, 0xFFFFFF);
		
		// Container for progress rectangles.
		this.progressContainer = this.scene.add.container(barX, barY);
		
		// Calculate how many rectangles we can fit vertically.
		const availableHeight = barHeight - (2 * this.PROGRESS_RECT_PADDING);
		const rectTotalHeight = this.PROGRESS_RECT_HEIGHT + this.PROGRESS_RECT_PADDING;
		this.maxRectangles = Math.floor(availableHeight / rectTotalHeight);
		
		// The starting Y position is at the bottom of the bar.
		const startRectY = barHeight / 2 - this.PROGRESS_RECT_PADDING - (this.PROGRESS_RECT_HEIGHT / 2);
		for (let i = 0; i < this.maxRectangles; i++) {
			// We subtract from the starting position to place subsequent rectangles above.
			const rectY = startRectY - (i * rectTotalHeight);
			const rect = this.scene.add.rectangle(
				0,
				rectY,
				barWidth - 8, // Rectangle width is almost the bar's width.
				this.PROGRESS_RECT_HEIGHT, // Rectangle height is its thickness.
				0x00FFFF // A bright cyan for accuracy.
			);
			rect.setScale(1, 0); // Start with 0 height (Y scale) for animation.
			rect.setAlpha(0);
			this.progressContainer.add(rect);
			this.progressRectangles.push(rect); // The array is now ordered bottom-to-top.
		}
		
		// Create title text.
		this.titleText = this.scene.add.text(barX, barY - (barHeight / 2) - 20, 'ACCURACY', {
			font: '14px monospace',
			fill: '#FFFFFF'
		}).setOrigin(0.5);
		
		// Create the percentage text.
		this.percentageText = this.scene.add.text(barX, barY, '0%', {
			font: '24px monospace',
			fill: '#FFFFFF',
			stroke: '#000000',
			strokeThickness: 4
		}).setOrigin(0.5);
		
		// Reset animation state trackers.
		this.currentPercentage = 0;
		this.percentageTween = null;
	}
	
	updateScoreBar() {
		if (!this.progressRectangles || this.progressRectangles.length === 0) {
			return; // UI not ready.
		}
		
		const totalDrops = this.correctDrops + this.incorrectDrops;
		const ratio = (totalDrops === 0) ? 0 : (this.correctDrops / totalDrops);
		const targetPercentage = Math.floor(ratio * 100);
		
		// Animate percentage counter.
		if (this.percentageTween) {
			this.percentageTween.stop();
		}
		
		this.percentageTween = this.scene.tweens.addCounter({
			from: this.currentPercentage,
			to: targetPercentage,
			duration: Math.abs(targetPercentage - this.currentPercentage) * 20,
			ease: 'Linear',
			onUpdate: (tween) => {
				const value = Math.floor(tween.getValue());
				if (this.percentageText) {
					this.percentageText.setText(`${value}%`);
				}
			},
			onComplete: () => {
				this.currentPercentage = targetPercentage;
			}
		});
		
		// Calculate how many rectangles should be visible.
		const rectanglesToShow = Math.floor(ratio * this.maxRectangles);
		
		// Animate rectangles. Because the array is ordered bottom-to-top,
		// this loop will animate the fill from the bottom up automatically.
		this.progressRectangles.forEach((rect, index) => {
			if (index < rectanglesToShow) {
				if (rect.scaleY === 0) {
					const delayIndex = index - this.lastRectanglesShown;
					this.scene.tweens.add({
						targets: rect,
						scaleY: 1,
						alpha: 1,
						duration: 200,
						ease: 'Back.easeOut',
						delay: Math.max(0, delayIndex) * this.PROGRESS_ANIMATION_DELAY
					});
				}
			} else {
				if (rect.scaleY > 0) {
					this.scene.tweens.add({
						targets: rect,
						scaleY: 0,
						alpha: 0,
						duration: 150,
						ease: 'Cubic.easeIn'
					});
				}
			}
		});
		
		// Update the count of visible rectangles for the next score update.
		this.lastRectanglesShown = rectanglesToShow;
	}
	
	handleResize(gameSize) {
		this.drawScoreboard();
		this.updateScoreBar();
	}
}

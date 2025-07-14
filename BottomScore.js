class BottomScore {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		
		// This object will store the persistent UI components for each score bar.
		this.scoreBarUIs = {};
		
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.BOTTOM_SCORE_SCREEN_HEIGHT = scoreScenesConfig.BOTTOM_SCORE_SCREEN_HEIGHT;
		this.INDIVIDUAL_MAX_SCORE = scoreScenesConfig.INDIVIDUAL_MAX_SCORE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	init() {
		console.log('BottomScore: init()');
		
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.scene.game.events.on('scorePoint', this.addScore, this);
		
		this.scene.game.events.on('startGoalAnimation', this.handleStartGoalAnimation, this);
		this.scene.game.events.on('endGoalAnimation', this.handleEndGoalAnimation, this);
	}
	
	handleBoardChange(config) {
		// First, clean up any UI elements from the previous configuration.
		for (const color in this.scoreBarUIs) {
			if (this.scoreBarUIs[color].container) {
				this.scoreBarUIs[color].container.destroy();
			}
		}
		this.scoreBarUIs = {};
		
		// Reset internal score tracking.
		this.scoreConfig.colors = config.colors;
		this.scoreConfig.goals = config.goals;
		this.scores = {};
		this.scoreConfig.colors.forEach(color => {
			this.scores[color] = 0;
		});
		
		// Re-create the UI for the new configuration.
		this.drawScoreboard();
	}
	
	addScore(data) {
		const color = data.color;
		if (this.scores[color] !== undefined) {
			this.scores[color]++;
			
			const ui = this.scoreBarUIs[color];
			if (!ui || !ui.isAnimating) {
				this.updateScoreBar(color);
			}
		}
	}
	
	drawScoreboard() {
		// Clean up any old UI elements that might exist (e.g. from a resize).
		for (const color in this.scoreBarUIs) {
			if (this.scoreBarUIs[color].container) {
				this.scoreBarUIs[color].container.destroy();
			}
		}
		this.scoreBarUIs = {};
		
		if (this.scoreConfig.goals.length === 0) {
			return;
		}
		
		const areaX = this.SELECTOR_SCREEN_WIDTH;
		const areaY = this.scene.scale.height - this.BOTTOM_SCORE_SCREEN_HEIGHT;
		const areaWidth = this.scene.scale.width - areaX;
		const areaHeight = this.BOTTOM_SCORE_SCREEN_HEIGHT;
		
		const numScores = this.scoreConfig.goals.length;
		const slotWidth = areaWidth / numScores;
		const textStyle = { font: '12px monospace', fill: '#000000', align: 'center' };
		
		const sortedGoals = [...this.scoreConfig.goals].sort((a, b) => a.side - b.side);
		
		sortedGoals.forEach((goal, index) => {
			const color = goal.color;
			
			const barHeight = areaHeight * 0.4;
			const barWidth = slotWidth * 0.8;
			const containerX = areaX + (slotWidth * index) + (slotWidth / 2);
			const containerY = areaY + areaHeight / 2;
			
			// Create a container for all parts of the score bar.
			const container = this.scene.add.container(containerX, containerY);
			
			// The main bar background/border.
			const drawer = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000, 0).setStrokeStyle(1, 0xFFFFFF, 0.8);
			
			// The colored fill part of the bar.
			const fillColor = Phaser.Display.Color.HexStringToColor(color).color;
			const fill = this.scene.add.rectangle(-(barWidth / 2), 0, 0, barHeight, fillColor).setOrigin(0, 0.5);
			
			// --- MODIFICATION START ---
			// The doors are now two rectangles, each half the width of the bar.
			// Their origins are set to act as hinges.
			const doorWidth = barWidth / 2;
			const doorHeight = barHeight;
			
			// Left door: Its origin (pivot point) is set to its left edge (0, 0.5).
			const doorLeft = this.scene.add.rectangle(
				-barWidth / 2, // Positioned to cover the left half of the bar.
				0,
				doorWidth,
				doorHeight,
				0x444444 // A dark grey color for the door.
			).setOrigin(0, 0.5).setStrokeStyle(1, 0xFFFFFF);
			
			// Right door: Its origin (pivot point) is set to its right edge (1, 0.5).
			const doorRight = this.scene.add.rectangle(
				barWidth / 2, // Positioned to cover the right half of the bar.
				0,
				doorWidth,
				doorHeight,
				0x444444
			).setOrigin(1, 0.5).setStrokeStyle(1, 0xFFFFFF);
			// --- MODIFICATION END ---
			
			// The score text.
			const scoreText = this.scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setStroke('#FFFFFF', 2);
			
			// The order in the container determines the draw order (last is on top).
			container.add([drawer, fill, doorLeft, doorRight, scoreText]);
			
			// Store all UI components for later access.
			this.scoreBarUIs[color] = {
				container: container,
				drawer: drawer,
				fill: fill,
				doorLeft: doorLeft,
				doorRight: doorRight,
				text: scoreText,
				originalY: containerY,
				barWidth: barWidth,
				isAnimating: false
			};
			
			// Update the bar to its initial state.
			this.updateScoreBar(color);
		});
	}
	
	/**
	 * Updates the visual state of a single score bar (fill width and text).
	 * @param {string} color The hex color string of the bar to update.
	 */
	updateScoreBar(color) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return;
		
		const score = this.scores[color] || 0;
		const progress = Math.min(score / this.INDIVIDUAL_MAX_SCORE, 1.0);
		
		// Update fill width.
		ui.fill.width = ui.barWidth * progress;
		
		// Update text.
		ui.text.setText(`${score}/${this.INDIVIDUAL_MAX_SCORE}`);
	}
	
	/**
	 * Provides the world coordinates for the ball to fly to during the scoring animation.
	 * @param {string} color The hex color string of the target score bar.
	 * @returns {{x: number, y: number}|null} The target coordinates or null if not found.
	 */
	getBarAnimationInfo(color) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return null;
		
		// The target is the center of the container, adjusted for the "drawer out" position.
		return {
			x: ui.container.x,
			y: ui.originalY + 20 // The Y position when the drawer is extended.
		};
	}
	
	/**
	 * Handles the 'startGoalAnimation' event, playing the "drawer out" and "doors open" tweens.
	 * @param {{color: string}} data The event data containing the color of the bar to animate.
	 */
	handleStartGoalAnimation({ color }) {
		const ui = this.scoreBarUIs[color];
		if (!ui || ui.isAnimating) return;
		
		ui.isAnimating = true;
		
		const timeline = this.scene.add.timeline([
			{
				at: 0, // Start immediately
				tween: {
					// 1. Drawer extends downwards.
					targets: ui.container,
					y: ui.originalY + 20,
					duration: 200,
					ease: 'Cubic.easeOut'
				}
			},
			// --- MODIFICATION START ---
			// The door tweens now animate the 'angle' property to create a swinging effect.
			{
				at: 200, // Start after the drawer moves.
				tween: {
					targets: ui.doorLeft,
					angle: -110, // Swing counter-clockwise by 110 degrees.
					ease: 'Cubic.easeOut',
					duration: 400
				}
			},
			{
				at: 200, // Start at the same time as the left door.
				tween: {
					targets: ui.doorRight,
					angle: 110, // Swing clockwise by 110 degrees.
					ease: 'Cubic.easeOut',
					duration: 400
				}
			}
			// --- MODIFICATION END ---
		]);
		
		timeline.play();
	}
	
	/**
	 * Handles the 'endGoalAnimation' event, playing the "doors close" and "drawer in" tweens.
	 * @param {{color: string}} data The event data containing the color of the bar to animate.
	 */
	handleEndGoalAnimation({ color }) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return;
		
		// The score has been updated via the 'scorePoint' event, so now we update the visuals.
		this.updateScoreBar(color);
		
		const timeline = this.scene.add.timeline([
			// --- MODIFICATION START ---
			// The door tweens now animate the 'angle' property back to 0.
			{
				at: 100, // 1. "Barn doors" close, after a 100ms delay.
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					angle: 0, // Swing back to the closed position.
					ease: 'Cubic.easeIn',
					duration: 400
				}
			},
			{
				at: 500, // 2. Drawer retracts upwards, after doors close (100ms delay + 400ms duration).
				tween: {
					targets: ui.container,
					y: ui.originalY,
					duration: 200,
					ease: 'Cubic.easeIn'
				}
			}
			// --- MODIFICATION END ---
		]);
		
		// The onComplete logic is handled by listening for the timeline's 'complete' event.
		timeline.on('complete', () => {
			// Animation is finished, reset the flag.
			if (ui) { // Check if ui still exists (e.g. board hasn't changed mid-animation)
				ui.isAnimating = false;
			}
		});
		
		timeline.play();
	}
	
	handleResize(gameSize) {
		// Re-creating the scoreboard is the simplest and most reliable way to handle a resize.
		this.drawScoreboard();
	}
}

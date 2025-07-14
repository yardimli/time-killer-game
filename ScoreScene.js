// --- Scene 4: The Score Board ---
class ScoreScene extends Phaser.Scene {
	constructor() {
		super({ key: 'ScoreScene', active: true });
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		this.scoreTextObjects = [];
		
		// --- MODIFICATION START ---
		// New properties for the total progress bar.
		this.progressBar = null;
		this.progressFill = null;
		this.percentageText = null;
		this.maxScore = 100; // The total score needed to fill the bar.
		// --- MODIFICATION END ---
		
		const sharedConfig = GAME_CONFIG.Shared;
		// The fixed height of this scene's viewport.
		this.SCORE_SCREEN_HEIGHT = sharedConfig.SCORE_SCREEN_HEIGHT;
		// Get the width of the setup scene to correctly offset this scene's viewport.
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	create() {
		console.log('ScoreScene: create()');
		
		// Position this scene's camera at the bottom, but offset by the setup scene's width.
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH, // Start after the left-side setup bar.
			this.scale.height - this.SCORE_SCREEN_HEIGHT,
			this.scale.width - this.SELECTOR_SCREEN_WIDTH, // Use remaining width.
			this.SCORE_SCREEN_HEIGHT
		);
		
		// --- NEW ---
		// Create the pixelated texture for the progress bar fill.
		this.createPixelTexture();
		
		// --- NEW ---
		// Create the UI elements for the progress bar.
		this.createProgressBarUI();
		
		// Listen for board changes to reset and draw the scoreboard.
		this.game.events.on('boardConfigurationChanged', (config) => {
			this.scoreConfig.colors = config.colors;
			this.scoreConfig.goals = config.goals;
			this.resetScores();
		}, this);
		
		// Listen for score events to update the scoreboard.
		this.game.events.on('scorePoint', (data) => {
			this.addScore(data.color);
		}, this);
		
		// Handle game resize to keep the UI responsive.
		this.scale.on('resize', (gameSize) => {
			this.cameras.main.setViewport(
				this.SELECTOR_SCREEN_WIDTH, // Start after the left-side setup bar.
				gameSize.height - this.SCORE_SCREEN_HEIGHT,
				gameSize.width - this.SELECTOR_SCREEN_WIDTH, // Use remaining width.
				this.SCORE_SCREEN_HEIGHT
			);
			this.drawScoreboard();
		}, this);
	}
	
	/**
	 * Creates a small, dithered/pixelated texture to use for the progress bar fill.
	 * This is done once during scene creation.
	 */
	createPixelTexture() {
		const textureKey = 'pixelFillTexture';
		if (this.textures.exists(textureKey)) {
			return;
		}
		
		const canvas = this.textures.createCanvas(textureKey, 4, 4);
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		
		ctx.fillStyle = '#FFFFFF';
		ctx.fillRect(0, 0, 4, 4);
		
		ctx.fillStyle = '#CCCCCC'; // A slightly darker color for the dither pattern.
		ctx.fillRect(1, 0, 1, 1);
		ctx.fillRect(3, 1, 1, 1);
		ctx.fillRect(0, 2, 1, 1);
		ctx.fillRect(2, 3, 1, 1);
		
		canvas.refresh();
	}
	
	/**
	 * Creates the persistent game objects for the progress bar UI.
	 * Their positions and content will be updated in drawScoreboard.
	 */
	createProgressBarUI() {
		// Graphics object for the progress bar's white border.
		this.progressBar = this.add.graphics();
		
		// A TileSprite for the fill, allowing the pixelated texture to repeat.
		this.progressFill = this.add.tileSprite(0, 0, 0, 0, 'pixelFillTexture');
		
		// Text object for the percentage display with a white outline and black fill.
		this.percentageText = this.add.text(0, 0, '0%', {
			font: '16px monospace',
			fill: '#000000',
			stroke: '#FFFFFF',
			strokeThickness: 3,
			align: 'center'
		}).setOrigin(0.5);
	}
	
	/**
	 * Resets all scores to zero and redraws the scoreboard.
	 * This is called when the board configuration changes.
	 */
	resetScores() {
		this.scores = {};
		this.scoreConfig.colors.forEach(color => {
			this.scores[color] = 0;
		});
		this.drawScoreboard();
	}
	
	/**
	 * Increments the score for a given color and redraws the scoreboard.
	 * @param {string} color - The hex color string of the goal scored in.
	 */
	addScore(color) {
		if (this.scores[color] !== undefined) {
			this.scores[color]++;
			this.drawScoreboard();
		}
	}
	
	/**
	 * Clears and redraws the entire scoreboard UI, including individual scores
	 * and the new total progress bar.
	 */
	drawScoreboard() {
		// --- MODIFICATION START ---
		// Clear previous drawings.
		this.scoreTextObjects.forEach(text => text.destroy());
		this.scoreTextObjects = [];
		this.progressBar.clear(); // Clear the graphics object for redrawing.
		
		if (this.scoreConfig.goals.length === 0) {
			this.progressFill.setVisible(false);
			this.percentageText.setVisible(false);
			return;
		}
		
		this.progressFill.setVisible(true);
		this.percentageText.setVisible(true);
		
		// Calculate total progress.
		const totalScore = Object.values(this.scores).reduce((sum, score) => sum + score, 0);
		const progress = Math.min(totalScore / this.maxScore, 1.0);
		
		// Define Progress Bar Geometry.
		// The top half of the scene is for the progress bar.
		const barHeight = 20;
		const barY = 5;
		const barWidth = this.cameras.main.width * 0.9;
		const barX = (this.cameras.main.width - barWidth) / 2;
		
		// Draw Progress Bar Border.
		this.progressBar.lineStyle(2, 0xFFFFFF, 1);
		this.progressBar.strokeRect(barX, barY, barWidth, barHeight);
		
		// Draw Progress Bar Fill (from right to left).
		const fillWidth = barWidth * progress;
		this.progressFill
			.setSize(fillWidth, barHeight)
			.setPosition(barX + barWidth, barY + barHeight / 2) // Anchor to the right edge.
			.setOrigin(1, 0.5); // Origin at the right-center to fill leftwards.
		
		// Update Percentage Text.
		this.percentageText
			.setText(`${Math.floor(progress * 100)}%`)
			.setPosition(barX + barWidth / 2, barY + barHeight / 2);
		
		// Draw Individual Scores.
		// The bottom half of the scene is for the individual scores.
		const numScores = this.scoreConfig.goals.length;
		const totalWidth = this.cameras.main.width;
		const slotWidth = totalWidth / numScores;
		const textStyle = {
			font: '16px monospace', // Slightly smaller font.
			fill: '#ffffff',
			align: 'center'
		};
		
		// Sort goals by side index to ensure a consistent display order.
		const sortedGoals = [...this.scoreConfig.goals].sort((a, b) => a.side - b.side);
		
		sortedGoals.forEach((goal, index) => {
			const color = goal.color;
			const score = this.scores[color] || 0;
			const centerX = slotWidth * index + slotWidth / 2;
			const centerY = 45; // Position in the bottom half of the scene.
			
			// Create a text object for the score.
			const scoreText = this.add.text(
				centerX,
				centerY,
				`${score}`, // Just show the number to save space.
				textStyle
			).setOrigin(0.5);
			
			// Use the goal's color for the text tint to make it identifiable.
			scoreText.setTint(Phaser.Display.Color.HexStringToColor(color).color);
			
			this.scoreTextObjects.push(scoreText);
		});
		// --- MODIFICATION END ---
	}
}

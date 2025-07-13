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
		
		const sharedConfig = GAME_CONFIG.Shared;
		// The fixed height of this scene's viewport.
		this.SCORE_SCREEN_HEIGHT = sharedConfig.SCORE_SCREEN_HEIGHT;
		// Get the width of the setup scene to correctly offset this scene's viewport.
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	create() {
		console.log('ScoreScene: create()');
		
		// --- Viewport adjusted to be to the right of the setup scene ---
		// Position this scene's camera at the bottom, but offset by the setup scene's width.
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH, // Start after the left-side setup bar.
			this.scale.height - this.SCORE_SCREEN_HEIGHT,
			this.scale.width - this.SELECTOR_SCREEN_WIDTH, // Use remaining width.
			this.SCORE_SCREEN_HEIGHT
		);
		
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
			// --- Viewport adjusted to be to the right of the setup scene ---
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
	 * Clears and redraws the entire scoreboard UI.
	 */
	drawScoreboard() {
		// Clear any existing text objects to prevent duplicates.
		this.scoreTextObjects.forEach(text => text.destroy());
		this.scoreTextObjects = [];
		
		if (this.scoreConfig.goals.length === 0) {
			return;
		}
		
		const numScores = this.scoreConfig.goals.length;
		const totalWidth = this.cameras.main.width;
		const slotWidth = totalWidth / numScores;
		const textStyle = {
			font: '20px monospace',
			fill: '#ffffff',
			align: 'center'
		};
		
		// Sort goals by side index to ensure a consistent display order.
		const sortedGoals = [...this.scoreConfig.goals].sort((a, b) => a.side - b.side);
		
		sortedGoals.forEach((goal, index) => {
			const color = goal.color;
			const score = this.scores[color] || 0;
			const centerX = slotWidth * index + slotWidth / 2;
			const centerY = this.SCORE_SCREEN_HEIGHT / 2;
			
			// Create a text object for the score.
			const scoreText = this.add.text(
				centerX,
				centerY,
				`Score: ${score}`,
				textStyle
			).setOrigin(0.5);
			
			// Use the goal's color for the text tint to make it identifiable.
			scoreText.setTint(Phaser.Display.Color.HexStringToColor(color).color);
			
			this.scoreTextObjects.push(scoreText);
		});
	}
}

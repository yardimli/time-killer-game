// --- Scene 5: The Bottom Score Bars ---
class BottomScoreScene extends Phaser.Scene {
	constructor() {
		super({ key: 'BottomScoreScene', active: true });
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		
		// UI elements for the individual progress bars.
		this.individualProgressBorders = null;
		this.individualProgressFills = null;
		this.individualScoreTexts = [];
		
		// Get configuration from the central config file.
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.BOTTOM_SCORE_SCREEN_HEIGHT = scoreScenesConfig.BOTTOM_SCORE_SCREEN_HEIGHT;
		this.INDIVIDUAL_MAX_SCORE = scoreScenesConfig.INDIVIDUAL_MAX_SCORE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	create() {
		console.log('BottomScoreScene: create()');
		
		this.cameras.main.setPostPipeline('Scanline');
		
		// Position this scene's camera at the bottom of the screen.
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH,
			this.scale.height - this.BOTTOM_SCORE_SCREEN_HEIGHT, // Position at bottom.
			this.scale.width - this.SELECTOR_SCREEN_WIDTH,
			this.BOTTOM_SCORE_SCREEN_HEIGHT
		);
		
		this.createIndividualProgressBarsUI();
		
		// Listen for events to update the score.
		this.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.game.events.on('scorePoint', this.addScore, this);
		
		// Handle resizing.
		this.scale.on('resize', this.handleResize, this);
	}
	
	/**
	 * Creates persistent graphics objects for the individual score bars.
	 */
	createIndividualProgressBarsUI() {
		this.individualProgressBorders = this.add.graphics();
		this.individualProgressFills = this.add.graphics();
	}
	
	/**
	 * Resets scores when the board configuration changes.
	 * @param {object} config - The new board configuration.
	 */
	handleBoardChange(config) {
		this.scoreConfig.colors = config.colors;
		this.scoreConfig.goals = config.goals;
		this.scores = {};
		this.scoreConfig.colors.forEach(color => {
			this.scores[color] = 0;
		});
		this.drawScoreboard();
	}
	
	/**
	 * Increments the score for a given color and redraws the UI.
	 * @param {object} data - The score data, containing the color.
	 */
	addScore(data) {
		const color = data.color;
		if (this.scores[color] !== undefined) {
			this.scores[color]++;
			this.drawScoreboard();
		}
	}
	
	/**
	 * Redraws all the individual progress bars.
	 */
	drawScoreboard() {
		this.individualProgressBorders.clear();
		this.individualProgressFills.clear();
		this.individualScoreTexts.forEach(text => text.destroy());
		this.individualScoreTexts = [];
		
		if (this.scoreConfig.goals.length === 0) {
			return;
		}
		
		const numScores = this.scoreConfig.goals.length;
		const slotWidth = this.cameras.main.width / numScores;
		const textStyle = { font: '12px monospace', fill: '#000000', align: 'center' };
		
		const sortedGoals = [...this.scoreConfig.goals].sort((a, b) => a.side - b.side);
		
		sortedGoals.forEach((goal, index) => {
			const color = goal.color;
			const score = this.scores[color] || 0;
			const individualProgress = Math.min(score / this.INDIVIDUAL_MAX_SCORE, 1.0);
			
			const barHeight = this.cameras.main.height * 0.4;
			const barY = this.cameras.main.height / 2 - barHeight / 2;
			const barWidth = slotWidth * 0.8;
			const barX = (slotWidth * index) + (slotWidth * 0.1);
			
			this.individualProgressBorders.lineStyle(1, 0xFFFFFF, 0.8);
			this.individualProgressBorders.strokeRect(barX, barY, barWidth, barHeight);
			
			const fillColor = Phaser.Display.Color.HexStringToColor(color).color;
			const fillWidth = barWidth * individualProgress;
			this.individualProgressFills.fillStyle(fillColor, 1.0);
			this.individualProgressFills.fillRect(barX, barY, fillWidth, barHeight);
			
			const scoreText = this.add.text(
				barX + barWidth / 2,
				barY + barHeight / 2,
				`${score}/${this.INDIVIDUAL_MAX_SCORE}`,
				textStyle
			).setOrigin(0.5);
			
			scoreText.setStroke('#FFFFFF', 2);
			this.individualScoreTexts.push(scoreText);
		});
	}
	
	/**
	 * Handles game window resizing.
	 * @param {Phaser.Structs.Size} gameSize - The new size of the game.
	 */
	handleResize(gameSize) {
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH,
			gameSize.height - this.BOTTOM_SCORE_SCREEN_HEIGHT,
			gameSize.width - this.SELECTOR_SCREEN_WIDTH,
			this.BOTTOM_SCORE_SCREEN_HEIGHT
		);
		this.drawScoreboard();
	}
}

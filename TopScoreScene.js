// --- Scene 4: The Top Score Bar ---
class TopScoreScene extends Phaser.Scene {
	constructor() {
		super({ key: 'TopScoreScene', active: true });
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		
		// UI elements for the total progress bar.
		this.totalProgressBar = null;
		this.totalProgressFill = null;
		this.totalPercentageText = null;
		
		// Get configuration from the central config file.
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.TOTAL_MAX_SCORE = scoreScenesConfig.TOTAL_MAX_SCORE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	create() {
		console.log('TopScoreScene: create()');
		
		// Position this scene's camera at the top of the screen.
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH,
			0, // Start at the top.
			this.scale.width - this.SELECTOR_SCREEN_WIDTH,
			this.TOP_SCORE_SCREEN_HEIGHT
		);
		
		this.createPixelTexture();
		this.createTotalProgressBarUI();
		
		// Listen for events to update the score.
		this.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.game.events.on('scorePoint', this.addScore, this);
		
		// Handle resizing.
		this.scale.on('resize', this.handleResize, this);
	}
	
	/**
	 * Creates a small, dithered/pixelated texture for the progress bar fill.
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
		
		ctx.fillStyle = '#CCCCCC';
		ctx.fillRect(1, 0, 1, 1);
		ctx.fillRect(3, 1, 1, 1);
		ctx.fillRect(0, 2, 1, 1);
		ctx.fillRect(2, 3, 1, 1);
		
		canvas.refresh();
	}
	
	/**
	 * Creates the persistent game objects for the total progress bar UI.
	 */
	createTotalProgressBarUI() {
		this.totalProgressBar = this.add.graphics();
		this.totalProgressFill = this.add.tileSprite(0, 0, 0, 0, 'pixelFillTexture');
		this.totalPercentageText = this.add.text(0, 0, '0%', {
			font: '16px monospace',
			fill: '#000000',
			stroke: '#FFFFFF',
			strokeThickness: 3,
			align: 'center'
		}).setOrigin(0.5);
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
	 * Redraws the total progress bar.
	 */
	drawScoreboard() {
		this.totalProgressBar.clear();
		
		if (this.scoreConfig.goals.length === 0) {
			this.totalProgressFill.setVisible(false);
			this.totalPercentageText.setVisible(false);
			return;
		}
		
		this.totalProgressFill.setVisible(true);
		this.totalPercentageText.setVisible(true);
		
		const totalScore = Object.values(this.scores).reduce((sum, score) => sum + score, 0);
		const totalProgress = Math.min(totalScore / this.TOTAL_MAX_SCORE, 1.0);
		
		const barHeight = this.cameras.main.height * 0.5;
		const barY = this.cameras.main.height / 2 - barHeight / 2;
		const barWidth = this.cameras.main.width * 0.9;
		const barX = (this.cameras.main.width - barWidth) / 2;
		
		this.totalProgressBar.lineStyle(2, 0xFFFFFF, 1);
		this.totalProgressBar.strokeRect(barX, barY, barWidth, barHeight);
		
		const fillWidth = barWidth * totalProgress;
		this.totalProgressFill
			.setSize(fillWidth, barHeight)
			.setPosition(barX + barWidth, barY + barHeight / 2)
			.setOrigin(1, 0.5);
		
		this.totalPercentageText
			.setText(`${Math.floor(totalProgress * 100)}%`)
			.setPosition(barX + barWidth / 2, barY + barHeight / 2);
	}
	
	/**
	 * Handles game window resizing.
	 * @param {Phaser.Structs.Size} gameSize - The new size of the game.
	 */
	handleResize(gameSize) {
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH,
			0,
			gameSize.width - this.SELECTOR_SCREEN_WIDTH,
			this.TOP_SCORE_SCREEN_HEIGHT
		);
		this.drawScoreboard();
	}
}

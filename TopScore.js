// --- The Top Score Bar Manager ---
// MODIFICATION: This class no longer extends Phaser.Scene. It's a manager class.
class TopScore {
	// MODIFICATION: The constructor now accepts the main scene.
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		
		this.totalProgressBar = null;
		this.totalProgressFill = null;
		this.totalPercentageText = null;
		
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.TOTAL_MAX_SCORE = scoreScenesConfig.TOTAL_MAX_SCORE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	// MODIFICATION: create() is renamed to init() to be called by the main scene.
	init() {
		console.log('TopScore: init()');
		// MODIFICATION: No camera or viewport setup needed.
		
		this.createPixelTexture();
		this.createTotalProgressBarUI();
		
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.scene.game.events.on('scorePoint', this.addScore, this);
		
		// MODIFICATION: The resize listener is removed, as it's handled by the main GameScene.
	}
	
	createPixelTexture() {
		const textureKey = 'pixelFillTexture';
		if (this.scene.textures.exists(textureKey)) {
			return;
		}
		
		const canvas = this.scene.textures.createCanvas(textureKey, 4, 4);
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
	
	createTotalProgressBarUI() {
		this.totalProgressBar = this.scene.add.graphics();
		this.totalProgressFill = this.scene.add.tileSprite(0, 0, 0, 0, 'pixelFillTexture');
		this.totalPercentageText = this.scene.add.text(0, 0, '0%', {
			font: '16px monospace',
			fill: '#000000',
			stroke: '#FFFFFF',
			strokeThickness: 3,
			align: 'center'
		}).setOrigin(0.5);
	}
	
	handleBoardChange(config) {
		this.scoreConfig.colors = config.colors;
		this.scoreConfig.goals = config.goals;
		this.scores = {};
		this.scoreConfig.colors.forEach(color => {
			this.scores[color] = 0;
		});
		this.drawScoreboard();
	}
	
	addScore(data) {
		const color = data.color;
		if (this.scores[color] !== undefined) {
			this.scores[color]++;
			this.drawScoreboard();
		}
	}
	
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
		
		// MODIFICATION: Calculate positions based on the full screen dimensions.
		const areaX = this.SELECTOR_SCREEN_WIDTH;
		const areaY = 0;
		const areaWidth = this.scene.scale.width - areaX;
		const areaHeight = this.TOP_SCORE_SCREEN_HEIGHT;
		
		const barHeight = areaHeight * 0.5;
		const barY = areaY + areaHeight / 2 - barHeight / 2;
		const barWidth = areaWidth * 0.9;
		const barX = areaX + (areaWidth - barWidth) / 2;
		
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
	
	handleResize(gameSize) {
		// MODIFICATION: No viewport to set, just redraw the scoreboard in its new position.
		this.drawScoreboard();
	}
}

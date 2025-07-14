class BottomScore {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		
		this.scores = {};
		this.scoreConfig = {
			colors: [],
			goals: []
		};
		
		this.individualProgressBorders = null;
		this.individualProgressFills = null;
		this.individualScoreTexts = [];
		
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.BOTTOM_SCORE_SCREEN_HEIGHT = scoreScenesConfig.BOTTOM_SCORE_SCREEN_HEIGHT;
		this.INDIVIDUAL_MAX_SCORE = scoreScenesConfig.INDIVIDUAL_MAX_SCORE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
	}
	
	init() {
		console.log('BottomScore: init()');
		
		this.createIndividualProgressBarsUI();
		
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.scene.game.events.on('scorePoint', this.addScore, this);
	}
	
	createIndividualProgressBarsUI() {
		this.individualProgressBorders = this.scene.add.graphics();
		this.individualProgressFills = this.scene.add.graphics();
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
		this.individualProgressBorders.clear();
		this.individualProgressFills.clear();
		this.individualScoreTexts.forEach(text => text.destroy());
		this.individualScoreTexts = [];
		
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
			const score = this.scores[color] || 0;
			const individualProgress = Math.min(score / this.INDIVIDUAL_MAX_SCORE, 1.0);
			
			const barHeight = areaHeight * 0.4;
			const barY = areaY + areaHeight / 2 - barHeight / 2;
			const barWidth = slotWidth * 0.8;
			const barX = areaX + (slotWidth * index) + (slotWidth * 0.1);
			
			this.individualProgressBorders.lineStyle(1, 0xFFFFFF, 0.8);
			this.individualProgressBorders.strokeRect(barX, barY, barWidth, barHeight);
			
			const fillColor = Phaser.Display.Color.HexStringToColor(color).color;
			const fillWidth = barWidth * individualProgress;
			this.individualProgressFills.fillStyle(fillColor, 1.0);
			this.individualProgressFills.fillRect(barX, barY, fillWidth, barHeight);
			
			const scoreText = this.scene.add.text(
				barX + barWidth / 2,
				barY + barHeight / 2,
				`${score}/${this.INDIVIDUAL_MAX_SCORE}`,
				textStyle
			).setOrigin(0.5);
			
			scoreText.setStroke('#FFFFFF', 2);
			this.individualScoreTexts.push(scoreText);
		});
	}
	
	handleResize(gameSize) {
		this.drawScoreboard();
	}
}

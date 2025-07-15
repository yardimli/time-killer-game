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
		
		// --- NEW: Centralized animation speed control ---
		// Change this single value to speed up or slow down the entire goal animation.
		// Original total time was ~2000ms.
		this.animationDuration = 2400; // Base duration in ms.
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
			// Only update the visual display if an animation is not in progress.
			// The display will be updated at the end of the animation anyway.
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
			
			const container = this.scene.add.container(containerX, containerY);
			
			// Modified: The background is now a black box with a white border, representing the drawer.
			const barBackground = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000).setStrokeStyle(2, 0xFFFFFF);
			
			// New: This container will hold the graphics for the collected balls.
			// It's positioned at the left edge of the bar background.
			const ballHolder = this.scene.add.container(-(barWidth / 2), 0);
			
			// This part is for the "drawer opening" animation effect.
			const drawerSlide = this.scene.add.rectangle(0, 0, barWidth * 0.95, 1, 0x222222).setOrigin(0.5, 1).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(color).color, 0.8);
			
			const doorWidth = barWidth / 2;
			const doorHeight = barHeight;
			const doorColor = Phaser.Display.Color.HexStringToColor(color).color;
			
			const doorLeft = this.scene.add.rectangle(-barWidth / 2, -15, doorWidth, doorHeight, doorColor).setOrigin(0, 0.5).setStrokeStyle(1, doorColor).setAlpha(0);
			const doorRight = this.scene.add.rectangle(barWidth / 2, -15, doorWidth, doorHeight, doorColor).setOrigin(1, 0.5).setStrokeStyle(1, doorColor).setAlpha(0);
			
			const scoreText = this.scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setStroke('#FFFFFF', 2);
			
			// Modified: The 'fill' rectangle is removed and 'ballHolder' is added.
			container.add([drawerSlide, barBackground, ballHolder, scoreText, doorLeft, doorRight]);
			
			// Modified: Storing a reference to ballHolder instead of the old fill bar.
			this.scoreBarUIs[color] = {
				container: container,
				barBackground: barBackground,
				drawerSlide: drawerSlide,
				ballHolder: ballHolder,
				doorLeft: doorLeft,
				doorRight: doorRight,
				text: scoreText,
				originalY: containerY,
				originalX: containerX,
				barWidth: barWidth,
				barHeight: barHeight,
				isAnimating: false
			};
			
			this.updateScoreBar(color);
		});
	}
	
	// Modified: This function now draws collected balls instead of a progress bar.
	updateScoreBar(color) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return;
		
		// Clear any previously drawn balls to prevent duplicates.
		ui.ballHolder.removeAll(true);
		
		const score = this.scores[color] || 0;
		// We only display up to the maximum, even if the score is higher.
		const ballsToShow = Math.min(score, this.INDIVIDUAL_MAX_SCORE);
		
		// --- Calculate dimensions for the collected balls ---
		const totalWidth = ui.barWidth;
		const maxBalls = this.INDIVIDUAL_MAX_SCORE;
		// The space allocated for each ball, including its margin.
		const slotWidth = totalWidth / maxBalls;
		// The ball's diameter is a percentage of the slot, leaving space for margins.
		const ballDiameter = slotWidth * 0.8;
		const ballRadius = ballDiameter / 2;
		
		const ballFillColor = Phaser.Display.Color.HexStringToColor(color).color;
		const highlightColor = Phaser.Display.Color.ValueToColor(color).lighten(50);
		
		// --- Draw the collected balls ---
		for (let i = 0; i < ballsToShow; i++) {
			// Calculate the center X position for the current ball within its slot.
			const ballX = (i * slotWidth) + (slotWidth / 2);
			const ballY = 0; // Y is 0 because it's relative to the vertically centered ballHolder.
			
			// Create a graphics object for each ball.
			const ballGraphic = this.scene.add.graphics({ x: ballX, y: ballY });
			
			// Draw the main ball color.
			ballGraphic.fillStyle(ballFillColor);
			ballGraphic.fillCircle(0, 0, ballRadius);
			
			// Add a simple highlight to give a 3D effect.
			ballGraphic.fillStyle(highlightColor.color, 0.6);
			ballGraphic.fillCircle(-ballRadius * 0.3, -ballRadius * 0.3, ballRadius * 0.4);
			
			// Add the new ball graphic to its container.
			ui.ballHolder.add(ballGraphic);
		}
		
		// Update the score text as before.
		ui.text.setText(`${score}/${this.INDIVIDUAL_MAX_SCORE}`);
	}
	
	getBarAnimationInfo(color) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return null;
		
		// The height of the drawer when it's fully extended.
		const openDrawerHeight = ui.barWidth * 0.55;
		
		// The Y coordinate of the bottom of the main score bar, which is where the drawer starts.
		const barBottomY = ui.originalY + (ui.barHeight / 2) - 100;
		
		// The center of the open drawer.
		const drawerCenterX = ui.originalX; // The drawer is horizontally aligned with the bar.
		const drawerCenterY = barBottomY; // Halfway down the extended drawer.
		
		return {
			x: drawerCenterX,
			y: drawerCenterY
		};
	}
	
	_createDoorUpdateHandler() {
		return (tween, target) => {
			const absAngle = Math.abs(target.angle);
			let scaleFactor = 1;
			
			if (absAngle <= 90) {
				scaleFactor = Math.cos(Phaser.Math.DegToRad(absAngle));
			} else {
				const maxAngle = 110;
				const anglePast90 = absAngle - 90;
				const progress = anglePast90 / (maxAngle - 90);
				scaleFactor = Math.sin(Phaser.Math.DegToRad(progress * 90));
			}
			
			target.scaleY = scaleFactor;
		};
	}
	
	handleStartGoalAnimation({ color }) {
		const ui = this.scoreBarUIs[color];
		if (!ui || ui.isAnimating) return;
		
		ui.isAnimating = true;
		
		const onDoorUpdate = this._createDoorUpdateHandler();
		
		const timeline = this.scene.add.timeline([
			{
				at: 0, // Doors start opening immediately.
				tween: {
					targets: ui.doorLeft,
					angle: -110,
					ease: 'Cubic.easeOut',
					duration: this.animationDuration * 0.6, // Doors take 60% of the total time to swing.
					onUpdate: onDoorUpdate
				}
			},
			{
				at: 0, // Right door opens simultaneously.
				tween: {
					targets: ui.doorRight,
					angle: 110,
					ease: 'Cubic.easeOut',
					duration: this.animationDuration * 0.6,
					onUpdate: onDoorUpdate
				}
			},
			{
				at: 0, // Doors fade in quickly at the start.
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					alpha: 1,
					duration: this.animationDuration * 0.125, // Fade takes 12.5% of total time.
					ease: 'Linear'
				}
			},
			{
				at: this.animationDuration * 0.15, // Drawer starts extending after a short delay (15% of total time).
				tween: {
					targets: ui.drawerSlide,
					height: (ui.barWidth * 0.55) * (-1),
					duration: this.animationDuration * 0.5, // Drawer slide takes 50% of total time.
					ease: 'Cubic.easeOut'
				}
			}
		]);
		
		timeline.play();
	}
	
	handleEndGoalAnimation({ color }) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return;
		
		this.updateScoreBar(color);
		
		const onDoorUpdate = this._createDoorUpdateHandler();
		
		const timeline = this.scene.add.timeline([
			{
				at: this.animationDuration * 0.05, // After a brief pause (5% of total time), drawer retracts.
				tween: {
					targets: ui.drawerSlide,
					height: 1,
					duration: this.animationDuration * 0.5, // Drawer slide takes 50% of total time.
					ease: 'Cubic.easeIn'
				}
			},
			{
				at: this.animationDuration * 0.15, // Doors start closing after drawer is mostly in (at 30% mark).
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					angle: 0,
					ease: 'Cubic.easeIn',
					duration: this.animationDuration * 0.6, // Doors take 60% of the total time to swing.
					onUpdate: onDoorUpdate
				}
			},
			{
				at: this.animationDuration * 0.8, // Doors start fading out for the last 20% of their close animation.
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					alpha: 0,
					duration: this.animationDuration * 0.125, // Fade takes 12.5% of total time.
					ease: 'Linear'
				}
			}
		]);
		
		timeline.on('complete', () => {
			if (ui) {
				ui.isAnimating = false;
				ui.doorLeft.scaleY = 1;
				ui.doorRight.scaleY = 1;
			}
		});
		
		timeline.play();
	}
	
	handleResize(gameSize) {
		this.drawScoreboard();
	}
}

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
		// --- MODIFIED: Added reference to the new right score bar width ---
		this.RIGHT_SCORE_SCREEN_WIDTH = sharedConfig.RIGHT_SCORE_SCREEN_WIDTH;
		
		// --- Centralized animation speed control ---
		// Change this single value to speed up or slow down the entire goal animation.
		// Original total time was ~2000ms.
		this.animationDuration = 2400; // Base duration in ms.
		
		// Configuration for ball layout
		this.BALLS_PER_ROW = 5;
		this.MAX_ROWS = 4; // 20 balls total = 4 rows of 5
		this.BALL_H_PADDING = 39 - (GAME_CONFIG.Shared.NUMBER_OF_SIDES * 3); // Horizontal padding between balls
		this.BALL_V_PADDING = 5; // Vertical padding between balls
		
		// Progress bar rectangle configuration
		this.PROGRESS_RECT_WIDTH = 3; // Width of each progress rectangle
		this.PROGRESS_RECT_PADDING = 2; // Padding between rectangles
		this.PROGRESS_ANIMATION_DELAY = 50; // Delay between each rectangle animation in ms
	}
	
	init() {
		console.log('BottomScore: init()');
		
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		this.scene.game.events.on('scorePoint', this.addScore, this);
		
		this.scene.game.events.on('startGoalAnimation', this.handleStartGoalAnimation, this);
		this.scene.game.events.on('endGoalAnimation', this.handleEndGoalAnimation, this);
		
		// --- NEW: Listen for changes to the max score configuration. ---
		this.scene.game.events.on('maxScoreChanged', this.handleMaxScoreChange, this);
	}
	
	// --- NEW: Handler for when the max score is changed via keyboard input. ---
	handleMaxScoreChange() {
		// Update the internal max score value from the global config.
		this.INDIVIDUAL_MAX_SCORE = GAME_CONFIG.ScoreScenes.INDIVIDUAL_MAX_SCORE;
		
		// Loop through all existing score bars and update their visuals.
		for (const color in this.scores) {
			if (this.scoreBarUIs[color]) {
				this.updateScoreBar(color);
			}
		}
	}
	
	handleBoardChange(config) {
		// First, clean up any UI elements from the previous configuration.
		for (const color in this.scoreBarUIs) {
			if (this.scoreBarUIs[color].container) {
				this.scoreBarUIs[color].container.destroy();
			}
		}
		this.scoreBarUIs = {};
		
		this.BALL_H_PADDING = 39 - (GAME_CONFIG.Shared.NUMBER_OF_SIDES * 3); // Horizontal padding between balls
		
		
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
		// --- MODIFIED: The available width is reduced by the new right score bar. ---
		const areaWidth = this.scene.scale.width - areaX - this.RIGHT_SCORE_SCREEN_WIDTH;
		const areaHeight = this.BOTTOM_SCORE_SCREEN_HEIGHT;
		
		const numScores = this.scoreConfig.goals.length;
		const slotWidth = areaWidth / numScores;
		// The text will be inside the bar, so white text with a dark stroke is better for contrast.
		const textStyle = { font: '20px monospace', fill: '#FFFFFF', align: 'left' };
		
		const sortedGoals = [...this.scoreConfig.goals].sort((a, b) => a.side - b.side);
		
		sortedGoals.forEach((goal, index) => {
			const color = goal.color;
			
			const barHeight = areaHeight * 0.4;
			const barWidth = slotWidth * 0.8;
			const containerX = areaX + (slotWidth * index) + (slotWidth / 2);
			const containerY = areaY + areaHeight / 2;
			
			const container = this.scene.add.container(containerX, containerY);
			
			// The main bar background - this is now the visible progress bar
			const barBackground = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x222222)
				.setStrokeStyle(2, 0xFFFFFF);
			
			// Container for progress rectangles
			const progressContainer = this.scene.add.container(0, 0);
			
			// Calculate how many rectangles we can fit
			const availableWidth = barWidth - (2 * this.PROGRESS_RECT_PADDING);
			const rectTotalWidth = this.PROGRESS_RECT_WIDTH + this.PROGRESS_RECT_PADDING;
			const maxRectangles = Math.floor(availableWidth / rectTotalWidth);
			
			// Store rectangles for later animation
			const progressRectangles = [];
			const startX = -barWidth / 2 + this.PROGRESS_RECT_PADDING + (this.PROGRESS_RECT_WIDTH / 2);
			
			for (let i = 0; i < maxRectangles; i++) {
				const rectX = startX + (i * rectTotalWidth);
				const rect = this.scene.add.rectangle(
					rectX,
					0,
					this.PROGRESS_RECT_WIDTH,
					barHeight - 8, // Slightly smaller than bar height
					Phaser.Display.Color.HexStringToColor(color).color
				);
				rect.setScale(0, 1); // Start with 0 width for animation
				rect.setAlpha(0);
				progressContainer.add(rect);
				progressRectangles.push(rect);
			}
			
			// Calculate drawer dimensions to fit 4 rows of 5 balls with padding
			const totalBallHSpace = (barWidth - this.BALL_H_PADDING) / this.BALLS_PER_ROW;
			const ballDiameter = totalBallHSpace - this.BALL_H_PADDING;
			const totalBallVSpace = ballDiameter + this.BALL_V_PADDING;
			const drawerHeight = totalBallVSpace * this.MAX_ROWS + this.BALL_V_PADDING; // Extra padding at bottom
			
			// This creates the illusion of a "slot" from which the drawer emerges.
			const drawerBackdrop = this.scene.add.rectangle(
				0,
				barHeight / 2,
				barWidth,
				drawerHeight,
				Phaser.Display.Color.HexStringToColor(GAME_CONFIG.BoardViewScene.backgroundColor).color
			).setOrigin(0.5, 0);
			
			// The drawer container that will hold both the drawer background and balls
			const drawerContainer = this.scene.add.container(0, barHeight / 2);
			
			// The drawer background
			const drawerSlide = this.scene.add.rectangle(
				0,
				0,
				barWidth * 0.95,
				drawerHeight,
				0x222222
			).setOrigin(0.5, 0).setStrokeStyle(1, 0x000000);
			
			// This container will hold the graphics for the collected balls.
			const ballHolder = this.scene.add.container(0, 0);
			
			// Add drawer background and ball holder to the drawer container
			drawerContainer.add([drawerSlide, ballHolder]);
			
			const doorWidth = barWidth / 2;
			const doorHeight = barHeight;
			const doorColor = Phaser.Display.Color.HexStringToColor(color).color;
			
			const doorLeft = this.scene.add.rectangle(-barWidth / 2, 0, doorWidth, doorHeight, doorColor, 0.1)
				.setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff).setAlpha(0);
			const doorRight = this.scene.add.rectangle(barWidth / 2, 0, doorWidth, doorHeight, doorColor, 0.1)
				.setOrigin(1, 0.5).setStrokeStyle(1, 0xffffff).setAlpha(0);
			
			// Position the text inside the bar, 100px from the left edge.
			const scoreText = this.scene.add.text(-barWidth / 2 + 100, 0, '0%', textStyle)
				.setOrigin(0, 0.5) // Origin is left-middle for precise positioning.
				.setStroke('#000000', 4); // Strong stroke for visibility over any color.
			
			// The container's add order is important for layering.
			container.add([
				drawerContainer,
				drawerBackdrop,
				barBackground,
				progressContainer,
				scoreText,
				doorLeft,
				doorRight
			]);
			
			// Storing properties for the position-based animation.
			this.scoreBarUIs[color] = {
				container: container,
				barBackground: barBackground,
				progressContainer: progressContainer,
				progressRectangles: progressRectangles,
				maxRectangles: maxRectangles,
				drawerContainer: drawerContainer,
				drawerSlide: drawerSlide,
				ballHolder: ballHolder,
				doorLeft: doorLeft,
				doorRight: doorRight,
				text: scoreText,
				originalY: containerY,
				originalX: containerX,
				barWidth: barWidth,
				barHeight: barHeight,
				isAnimating: false,
				closedDrawerY: 0,
				openDrawerY: drawerHeight * (-1), // Negative to slide up
				drawerHeight: drawerHeight,
				ballDiameter: ballDiameter,
				ballHPadding: this.BALL_H_PADDING,
				ballVPadding: this.BALL_V_PADDING,
				totalBallHSpace: totalBallHSpace,
				totalBallVSpace: totalBallVSpace,
				currentPercentage: 0, // Track current displayed percentage
				percentageTween: null, // Store reference to percentage tween
				lastRectanglesShown: 0 // NEW: Track visible rectangles for correct animation delay.
			};
			
			this.updateScoreBar(color);
		});
	}
	
	updateScoreBar(color) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return;
		
		const score = this.scores[color] || 0;
		
		// Calculate target percentage
		const targetPercentage = this.INDIVIDUAL_MAX_SCORE > 0
			? Math.floor((score / this.INDIVIDUAL_MAX_SCORE) * 100)
			: 0;
		
		// Animate percentage counter
		if (ui.percentageTween) {
			ui.percentageTween.stop();
		}
		
		ui.percentageTween = this.scene.tweens.addCounter({
			from: ui.currentPercentage,
			to: targetPercentage,
			duration: Math.abs(targetPercentage - ui.currentPercentage) * 50, // 50ms per percentage point
			ease: 'Linear',
			onUpdate: (tween) => {
				const value = Math.floor(tween.getValue());
				ui.text.setText(`${value}%`);
			},
			onComplete: () => {
				ui.currentPercentage = targetPercentage;
			}
		});
		
		// Calculate how many rectangles should be visible
		const rectanglesToShow = Math.floor((targetPercentage / 100) * ui.maxRectangles);
		
		// Animate rectangles
		ui.progressRectangles.forEach((rect, index) => {
			if (index < rectanglesToShow) {
				// Check if this rectangle is already visible
				if (rect.scaleX === 0) {
					// MODIFIED: Calculate delay relative to the last visible rectangle.
					const delayIndex = index - ui.lastRectanglesShown;
					
					// Animate this rectangle appearing
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
				// Hide rectangles that should not be visible
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
		ui.lastRectanglesShown = rectanglesToShow;
		
		// Update balls in drawer
		ui.ballHolder.removeAll(true);
		
		const ballsToShow = Math.min(score, this.INDIVIDUAL_MAX_SCORE);
		const ballRadius = ui.ballDiameter / 2;
		const ballFillColor = Phaser.Display.Color.HexStringToColor(color).color;
		const highlightColor = Phaser.Display.Color.ValueToColor(color).lighten(50);
		
		// Calculate starting position for centering balls
		const totalWidth = this.BALLS_PER_ROW * ui.totalBallHSpace - ui.ballHPadding;
		const startX = -totalWidth / 2 + ballRadius;
		const startY = ballRadius + ui.ballVPadding / 2;
		
		for (let i = 0; i < ballsToShow; i++) {
			const row = Math.floor(i / this.BALLS_PER_ROW);
			const col = i % this.BALLS_PER_ROW;
			
			const ballX = startX + (col * ui.totalBallHSpace);
			const ballY = startY + (row * ui.totalBallVSpace);
			
			const ballGraphic = this.scene.add.graphics({ x: ballX, y: ballY });
			
			// Main ball
			ballGraphic.fillStyle(ballFillColor);
			ballGraphic.fillCircle(0, 0, ballRadius);
			
			// Highlight
			ballGraphic.fillStyle(highlightColor.color, 0.6);
			ballGraphic.fillCircle(-ballRadius * 0.3, -ballRadius * 0.3, ballRadius * 0.4);
			
			// Outline
			ballGraphic.lineStyle(1, 0x000000, 0.3);
			ballGraphic.strokeCircle(0, 0, ballRadius);
			
			ui.ballHolder.add(ballGraphic);
		}
	}
	
	getBarAnimationInfo(color) {
		const ui = this.scoreBarUIs[color];
		if (!ui) return null;
		
		const score = this.scores[color] || 0;
		const nextBallIndex = Math.min(score, this.INDIVIDUAL_MAX_SCORE - 1); // The index of the next ball to be placed
		
		// Calculate the position of the next ball
		const row = Math.floor(nextBallIndex / this.BALLS_PER_ROW);
		const col = nextBallIndex % this.BALLS_PER_ROW;
		
		const ballRadius = ui.ballDiameter / 2;
		const totalWidth = this.BALLS_PER_ROW * ui.totalBallHSpace - ui.ballHPadding;
		const startX = -totalWidth / 2 + ballRadius + ui.ballHPadding / 2;
		const startY = ballRadius + ui.ballVPadding / 2;
		
		const ballX = startX + (col * ui.totalBallHSpace);
		const ballY = startY + (row * ui.totalBallVSpace);
		
		// Convert drawer-relative position to world position
		// When drawer is open, its Y position is ui.openDrawerY
		const drawerWorldY = ui.originalY + (ui.barHeight / 2) + ui.openDrawerY;
		const ballWorldX = ui.originalX + ballX;
		const ballWorldY = drawerWorldY + ballY;
		
		return {
			x: ballWorldX,
			y: ballWorldY
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
				at: 0,
				tween: {
					targets: ui.doorLeft,
					angle: -110,
					ease: 'Cubic.easeOut',
					duration: this.animationDuration * 0.6,
					onUpdate: onDoorUpdate
				}
			},
			{
				at: 0,
				tween: {
					targets: ui.doorRight,
					angle: 110,
					ease: 'Cubic.easeOut',
					duration: this.animationDuration * 0.6,
					onUpdate: onDoorUpdate
				}
			},
			{
				at: 0,
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					alpha: 1,
					duration: this.animationDuration * 0.125,
					ease: 'Linear'
				}
			},
			{
				at: this.animationDuration * 0.15,
				tween: {
					targets: ui.drawerContainer,
					y: ui.openDrawerY,
					duration: this.animationDuration * 0.5,
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
				at: this.animationDuration * 0.05,
				tween: {
					targets: ui.drawerContainer,
					y: ui.closedDrawerY,
					duration: this.animationDuration * 0.5,
					ease: 'Cubic.easeIn'
				}
			},
			{
				at: this.animationDuration * 0.15,
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					angle: 0,
					ease: 'Cubic.easeIn',
					duration: this.animationDuration * 0.6,
					onUpdate: onDoorUpdate
				}
			},
			{
				at: this.animationDuration * 0.8,
				tween: {
					targets: [ui.doorLeft, ui.doorRight],
					alpha: 0,
					duration: this.animationDuration * 0.125,
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

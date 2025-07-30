/**
 * @file The main and only Phaser Scene for the game.
 * This scene orchestrates all the different parts of the game (board, balls, UI)
 * which are encapsulated in their own manager classes.
 */
class GameScene extends Phaser.Scene {
	constructor() {
		super({ key: 'GameScene' });
		
		this.boardSetup = null;
		this.boardView = null;
		this.ballManager = null;
		this.topScore = null;
		this.bottomScore = null;
		this.rightScore = null; // New: Reference for the accuracy score manager.
		this.gameOverManager = null; // --- NEW: Reference for the Game Over manager. ---
		this.customCursor = null;
		
		// --- NEW: Properties for max score UI feedback ---
		this.maxScoreText = null;
		this.maxScoreTextTimer = null;
		
		// --- NEW: Property for the initial hint text ---
		this.hintText = null;
	}
	
	preload() {
		console.log('GameScene: preload()');
		// Preload all assets for all managers in one place.
		// From BallManager
		this.load.audio('drop', 'assets/audio/DSGNBass_Smooth Sub Drop Bass Downer.wav');
		this.load.audio('bounce1', 'assets/audio/basketball_bounce_single_3.wav');
		this.load.audio('bounce2', 'assets/audio/basketball_bounce_single_5.wav');
		this.load.audio('bounce3', 'assets/audio/Vintage Bounce.wav');
		this.load.audio('click', 'assets/audio/basketball_bounce_single_5.wav');
		this.load.audio('click_drop', 'assets/audio/basketball_bounce_single_3.wav');
		
		this.load.audio('drop_valid', 'assets/audio/Drop Game Potion.wav');
		this.load.audio('drop_invalid', 'assets/audio/Hit Item Dropped 2.wav');
		
		this.load.plugin('rexcrtpipelineplugin', 'rexcrtpipelineplugin.min.js', true);
	}
	
	create() {
		console.log('GameScene: create()');
		
		// Set up post-processing pipelines on the single main camera.
		this.cameras.main.setPostPipeline(['Glitch']);
		this.cameras.main.setBackgroundColor(GAME_CONFIG.BoardViewScene.backgroundColor);
		
		var postFxPlugin = this.plugins.get('rexcrtpipelineplugin');
		var postFxPipeline = postFxPlugin.add(this.cameras.main, {
			warpX: 0.15,
			warpY: 0.15,
			scanLineStrength: 0.1,
			scanLineWidth: 1024
		});
		
		// Create a texture for the custom cursor.
		const cursorSize = 32; // A 32x32 cursor is about twice the size of a standard 16x16 one.
		const cursorGraphics = this.make.graphics();
		cursorGraphics.lineStyle(2, 0xFFFFFF, 1);
		
		// Draw a simple crosshair shape.
		cursorGraphics.moveTo(cursorSize / 2, 0);
		cursorGraphics.lineTo(cursorSize / 2, cursorSize);
		cursorGraphics.moveTo(0, cursorSize / 2);
		cursorGraphics.lineTo(cursorSize, cursorSize / 2);
		cursorGraphics.strokePath();
		
		// Generate a texture from the graphics object and then destroy the graphics object.
		cursorGraphics.generateTexture('customCursorTexture', cursorSize, cursorSize);
		cursorGraphics.destroy();
		
		// Create the cursor sprite using the new texture.
		this.customCursor = this.add.image(0, 0, 'customCursorTexture');
		// Set a very high depth to ensure the cursor is always drawn on top of everything else.
		this.customCursor.setDepth(1000);
		
		// --- MODIFIED: Instantiation order is critical for dependency injection. ---
		// UI managers are created first, then logic managers that may depend on them.
		this.boardView = new BoardView(this);
		this.topScore = new TopScore(this);
		this.bottomScore = new BottomScore(this);
		this.rightScore = new RightScore(this); // New: Instantiate the accuracy score manager.
		this.ballManager = new BallManager(this, this.boardView, this.bottomScore); // Pass bottomScore reference.
		this.boardSetup = new BoardSetup(this);
		this.gameOverManager = new GameOver(this); // --- NEW: Instantiate the Game Over manager. ---
		
		// --- NEW: Create the text object for max score feedback. ---
		this.maxScoreText = this.add.text(0, 0, '', {
				font: '18px monospace',
				fill: '#FFFF00',
				backgroundColor: '#00000080',
				padding: { x: 10, y: 5 }
			})
			.setOrigin(1, 1) // Position from bottom-right.
			.setDepth(1001) // Ensure it's on top of everything.
			.setVisible(false);
		
		// --- NEW: Create and display the initial hint text. ---
		const gameSize = this.scale.gameSize;
		this.hintText = this.add.text(
				gameSize.width / 2,
				gameSize.height / 2,
				'USE Q and A keys to increase/decrease Goal Max Scores',
				{
					font: '24px monospace',
					fill: '#FFFFFF',
					align: 'center',
					stroke: '#000000',
					strokeThickness: 6,
					backgroundColor: '#000000B0', // Semi-transparent background
					padding: { x: 20, y: 10 }
				}
			)
			.setOrigin(0.5)
			.setDepth(2000); // High depth to appear on top.
		
		// Set a timer to hide the hint text after 3 seconds.
		this.time.delayedCall(3000, () => {
			if (this.hintText) {
				// Use a tween for a smooth fade-out effect.
				this.tweens.add({
					targets: this.hintText,
					alpha: 0,
					duration: 500,
					onComplete: () => {
						this.hintText.setVisible(false);
					}
				});
			}
		}, [], this);
		
		// 1. Initialize all managers to create their respective game objects.
		this.boardView.init();
		this.topScore.init();
		this.bottomScore.init();
		this.rightScore.init(); // New: Initialize the accuracy score manager.
		this.ballManager.init();
		this.boardSetup.init(); // This now ONLY creates the UI elements.
		this.gameOverManager.init(); // --- NEW: Initialize the Game Over manager. ---
		
		// 2. Set up the resize listener.
		// this.scale.on('resize', this.handleResize, this);
		
		// 3. Manually trigger the first resize to position all newly created elements correctly.
		this.handleResize(this.scale.gameSize);
		
		// 4. After everything is created and positioned, emit the initial board configuration.
		// This ensures all listeners (like the wall builder) have the correct positional data.
		this.boardSetup.emitBoardConfiguration();
		
		// --- NEW: Add keyboard listeners for changing the max score. ---
		this.input.keyboard.on('keydown-Q', () => this.changeMaxScore(1));
		this.input.keyboard.on('keydown-A', () => this.changeMaxScore(-1));
	}
	
	// --- NEW: Method to handle changing the max score and updating UI. ---
	changeMaxScore(amount) {
		const scoreConfig = GAME_CONFIG.ScoreScenes;
		
		// Change the individual max score, ensuring it doesn't go below 1.
		scoreConfig.INDIVIDUAL_MAX_SCORE += amount;
		scoreConfig.INDIVIDUAL_MAX_SCORE = Math.max(1, scoreConfig.INDIVIDUAL_MAX_SCORE);
		
		// Recalculate the total max score based on the new individual max and number of sides.
		scoreConfig.TOTAL_MAX_SCORE = scoreConfig.INDIVIDUAL_MAX_SCORE * GAME_CONFIG.Shared.NUMBER_OF_SIDES;
		
		// Update the feedback text.
		this.maxScoreText.setText(`${scoreConfig.INDIVIDUAL_MAX_SCORE}`);
		this.maxScoreText.setVisible(true);
		
		// Remove any existing timer to reset its duration.
		if (this.maxScoreTextTimer) {
			this.maxScoreTextTimer.remove();
		}
		
		// Set a timer to hide the text after 3 seconds.
		this.maxScoreTextTimer = this.time.delayedCall(3000, () => {
			this.maxScoreText.setVisible(false);
		}, [], this);
		
		// Emit an event to notify other managers (TopScore, BottomScore) of the change.
		this.game.events.emit('maxScoreChanged');
		console.log(`Max score per goal changed to: ${scoreConfig.INDIVIDUAL_MAX_SCORE}`);
	}
	
	update(time, delta) {
		// In each frame, update the custom cursor's position to follow the mouse pointer.
		if (this.customCursor) {
			this.customCursor.setPosition(this.input.activePointer.x, this.input.activePointer.y);
		}
		
		// Call the update loop for each manager that needs it.
		this.boardView.update(time, delta);
		this.ballManager.update(time, delta);
	}
	
	handleResize(gameSize) {
		// Inform all managers that the game size has changed.
		this.boardView.handleResize(gameSize);
		this.boardSetup.handleResize(gameSize);
		this.topScore.handleResize(gameSize);
		this.bottomScore.handleResize(gameSize);
		this.rightScore.handleResize(gameSize); // New: Inform the accuracy score manager of resize.
		
		// --- NEW: Reposition the max score feedback text on resize. ---
		if (this.maxScoreText) {
			this.maxScoreText.setPosition(gameSize.width - 10, gameSize.height - 10);
		}
		
		// --- NEW: Reposition the hint text on resize if it's visible. ---
		if (this.hintText && this.hintText.visible) {
			this.hintText.setPosition(gameSize.width / 2, gameSize.height / 2);
		}
	}
}

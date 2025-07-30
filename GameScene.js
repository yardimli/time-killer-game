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
		this.customCursor = null;
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
		
		// Instantiate all the game logic managers.
		this.boardView = new BoardView(this);
		this.ballManager = new BallManager(this, this.boardView);
		this.boardSetup = new BoardSetup(this);
		this.topScore = new TopScore(this);
		this.bottomScore = new BottomScore(this);
		this.rightScore = new RightScore(this); // New: Instantiate the accuracy score manager.
		
		// The initialization order is now critical.
		
		// 1. Initialize all managers to create their respective game objects.
		this.boardView.init();
		this.ballManager.init();
		this.topScore.init();
		this.bottomScore.init();
		this.rightScore.init(); // New: Initialize the accuracy score manager.
		this.boardSetup.init(); // This now ONLY creates the UI elements.
		
		// 2. Set up the resize listener.
		this.scale.on('resize', this.handleResize, this);
		
		// 3. Manually trigger the first resize to position all newly created elements correctly.
		this.handleResize(this.scale.gameSize);
		
		// 4. After everything is created and positioned, emit the initial board configuration.
		// This ensures all listeners (like the wall builder) have the correct positional data.
		this.boardSetup.emitBoardConfiguration();
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
	}
}

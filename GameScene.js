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
	}
	
	preload() {
		console.log('GameScene: preload()');
		// Preload all assets for all managers in one place.
		// From BallManager
		this.load.audio('drop', 'assets/audio/DSGNBass_Smooth Sub Drop Bass Downer.wav');
		this.load.audio('bounce1', 'assets/audio/basketball_bounce_single_3.wav');
		this.load.audio('bounce2', 'assets/audio/basketball_bounce_single_5.wav');
		this.load.audio('bounce3', 'assets/audio/Vintage Bounce.wav');
		this.load.audio('click', 'assets/audio/Item Pick Up.wav');
		this.load.audio('drop_valid', 'assets/audio/Drop Game Potion.wav');
		this.load.audio('drop_invalid', 'assets/audio/Hit Item Dropped 2.wav');
	}
	
	create() {
		console.log('GameScene: create()');
		
		// Set up post-processing pipelines on the single main camera.
		this.cameras.main.setPostPipeline(['Glitch']);
		this.cameras.main.setBackgroundColor(GAME_CONFIG.BoardViewScene.backgroundColor);
		
		// Instantiate all the game logic managers.
		this.boardView = new BoardView(this);
		this.ballManager = new BallManager(this, this.boardView);
		this.boardSetup = new BoardSetup(this);
		this.topScore = new TopScore(this);
		this.bottomScore = new BottomScore(this);
		
		// MODIFICATION: The initialization order is now critical.
		
		// 1. Initialize all managers to create their respective game objects.
		this.boardView.init();
		this.ballManager.init();
		this.topScore.init();
		this.bottomScore.init();
		this.boardSetup.init(); // This now ONLY creates the UI elements.
		
		// 2. Set up the resize listener.
		this.scale.on('resize', this.handleResize, this);
		
		// 3. Manually trigger the first resize to position all newly created elements correctly.
		this.handleResize(this.scale.gameSize);
		
		// 4. After everything is created and positioned, emit the initial board configuration.
		// This ensures all listeners (like the wall builder) have the correct positional data.
		this.boardSetup.emitBoardConfiguration();
		
		// now add our shader
		const baseShader = new Phaser.Display.BaseShader('BufferShader', crtShader)
		this.add.shader(baseShader, 0, 0, this.scale.width, this.scale.height).setOrigin(0, 0)
	}
	
	update(time, delta) {
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
	}
}

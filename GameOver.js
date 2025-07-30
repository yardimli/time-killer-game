/**
 * @file Manages the "Game Over" sequence, including text and fireworks.
 */
class GameOver {
	/**
	 * @param {Phaser.Scene} scene The main game scene.
	 */
	constructor(scene) {
		this.scene = scene;
		
		this.gameOverText = null;
		this.colorChangeTimer = null;
		this.fireworksTimer = null;
		
		// A unique key for our dynamically created particle texture.
		this.particleTextureKey = 'pixel_particle';
	}
	
	/**
	 * Initializes the manager by creating assets and setting up event listeners.
	 */
	init() {
		console.log('GameOver: init()');
		
		this.createParticleTexture();
		
		// Listen for the 'gameOver' event from the TopScore manager.
		this.scene.game.events.on('gameOver', this.start, this);
		
		// When the board configuration changes, it means a new game has started.
		// We need to stop any ongoing "Game Over" animations.
		this.scene.game.events.on('boardConfigurationChanged', this.reset, this);
	}
	
	/**
	 * Creates a small, white, pixelated texture to use for the firework particles.
	 */
	createParticleTexture() {
		if (this.scene.textures.exists(this.particleTextureKey)) {
			return;
		}
		
		const size = 4;
		const graphics = this.scene.make.graphics();
		graphics.fillStyle(0xffffff);
		graphics.fillRect(0, 0, size, size);
		graphics.generateTexture(this.particleTextureKey, size, size);
		graphics.destroy();
	}
	
	/**
	 * Starts the "Game Over" sequence.
	 */
	start() {
		console.log('GameOver: start()');
		
		const gameSize = this.scene.scale.gameSize;
		const centerX = gameSize.width / 2;
		const centerY = gameSize.height / 2;
		
		// --- Create the "Game Over" Text ---
		if (!this.gameOverText) {
			this.gameOverText = this.scene.add.text(centerX, centerY, 'GAME OVER\nTHANKS FOR PLAYING', {
				font: '68px monospace',
				fill: '#FFFFFF',
				align: 'center',
				stroke: '#000000',
				strokeThickness: 8
			}).setOrigin(0.5).setDepth(2000); // High depth to be on top of everything.
		}
		this.gameOverText.setVisible(true);
		
		// --- Start Timers for Animations ---
		// Timer to change the text color every 2 seconds.
		this.colorChangeTimer = this.scene.time.addEvent({
			delay: 1000,
			callback: this.changeTextColor,
			callbackScope: this,
			loop: true
		});
		
		// Timer to launch a firework every 800ms.
		this.fireworksTimer = this.scene.time.addEvent({
			delay: 800,
			callback: this.launchFirework,
			callbackScope: this,
			loop: true
		});
	}
	
	/**
	 * Stops all "Game Over" animations and hides the UI.
	 */
	reset() {
		if (this.colorChangeTimer) {
			this.colorChangeTimer.remove();
			this.colorChangeTimer = null;
		}
		if (this.fireworksTimer) {
			this.fireworksTimer.remove();
			this.fireworksTimer = null;
		}
		if (this.gameOverText) {
			this.gameOverText.setVisible(false);
		}
	}
	
	/**
	 * Changes the fill color of the "Game Over" text to a random color.
	 */
	changeTextColor() {
		if (this.gameOverText) {
			const randomColor = Phaser.Utils.Array.GetRandom(GAME_CONFIG.Shared.BALL_COLORS);
			this.gameOverText.setFill(randomColor);
		}
	}
	
	/**
	 * Launches a single firework burst at a random location on the screen.
	 */
	launchFirework() {
		const gameSize = this.scene.scale.gameSize;
		
		// Pick a random launch position within the main play area.
		const x = Phaser.Math.Between(GAME_CONFIG.Shared.SELECTOR_SCREEN_WIDTH, gameSize.width - GAME_CONFIG.Shared.RIGHT_SCORE_SCREEN_WIDTH);
		const y = Phaser.Math.Between(GAME_CONFIG.ScoreScenes.TOP_SCORE_SCREEN_HEIGHT, gameSize.height - GAME_CONFIG.ScoreScenes.BOTTOM_SCORE_SCREEN_HEIGHT);
		
		// --- MODIFIED: Updated to Phaser 3.60+ particle emitter API ---
		// The old `this.scene.add.particles(texture).createEmitter(config)` is deprecated.
		// The new API creates the emitter directly and is more concise.
		const emitter = this.scene.add.particles(x, y, this.particleTextureKey, {
			// Use the game's ball colors for the particles.
			color: GAME_CONFIG.Shared.BALL_COLORS.map(c => Phaser.Display.Color.HexStringToColor(c).color),
			lifespan: 1000,
			speed: { min: 100, max: 300 },
			scale: { start: 1, end: 0 },
			gravityY: 200,
			blendMode: 'ADD', // 'ADD' blend mode creates a bright, glowing effect.
			// The emitter will fire once and then be removed automatically.
			emitting: false
		});
		
		// The emitter itself is a GameObject, so we can set its depth.
		emitter.setDepth(1500);
		
		// Call explode directly on the emitter instance to fire the burst.
		emitter.explode(50);
	}
}

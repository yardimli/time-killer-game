// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	scale: {
		mode: Phaser.Scale.RESIZE,
		parent: 'phaser-example',
		width: '100%',
		height: '100%'
	},
	// --- MODIFICATION START ---
	// Added the Arcade Physics engine configuration.
	// Gravity is set to 0 as we will control ball movement manually.
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 0 }
			// debug: true // Uncomment to see physics bodies for debugging
		}
	},
	// --- MODIFICATION END ---
	pixelArt: true,
	// --- MODIFICATION START ---
	// Added the new BallScene to the game's scene list.
	scene: [BoardSetupScene, BoardViewScene, BallScene],
	// --- MODIFICATION END ---
	render: {
		pipeline: {
			'Glitch': GlitchPostFxPipeline
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);
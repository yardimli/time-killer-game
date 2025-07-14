// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	// width: 1280,
	// height: 720,
	width: '100%',
	height: '100%',
	scale: {
		mode: Phaser.Scale.FIT,
		// mode: Phaser.Scale.RESIZE,
		parent: 'phaser-example',
		// width: '100%',
		// height: '100%'
	},
	physics: {
		default: 'matter',
		matter: {
			gravity: { y: 0 },
			debug: false // Shows Matter.js physics bodies, vectors, and collisions.
		}
	},
	pixelArt: true,
	scene: [BoardSetupScene, BoardViewScene, BallScene, TopScoreScene, BottomScoreScene],
	render: {
		//  Make the main game canvas transparent.
		// This allows the background color set on individual scene cameras to show through.
		transparent: true,
		pipeline: {
			'Glitch': GlitchPostFxPipeline
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);

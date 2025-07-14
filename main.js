// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	// width: 1280,
	// height: 720,
	width: '100%',
	height: '100%',
	// backgroundColor: '#000000',
	scale: {
		mode: Phaser.Scale.FIT,
		parent: 'phaser-example',
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
		transparent: true,
		pipeline: {
			'Glitch': GlitchPostFxPipeline,
			'Scanline': ScanlinePostFxPipeline
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);

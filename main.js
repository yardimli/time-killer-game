// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	scale: {
		mode: Phaser.Scale.RESIZE,
		parent: 'phaser-example',
		width: '100%',
		height: '100%'
	},
	physics: {
		default: 'matter',
		matter: {
			gravity: { y: 0 },
			debug: false // Shows Matter.js physics bodies, vectors, and collisions.
		}
	},
	pixelArt: true,
	scene: [BoardSetupScene, BoardViewScene, BallScene, ScoreScene],
	render: {
		pipeline: {
			'Glitch': GlitchPostFxPipeline
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);

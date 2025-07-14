// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	width: '100%',
	height: '100%',
	scale: {
		mode: Phaser.Scale.FIT,
		parent: 'phaser-example'
	},
	physics: {
		default: 'matter',
		matter: {
			gravity: { y: 0 },
			debug: false // Shows Matter.js physics bodies, vectors, and collisions.
		}
	},
	pixelArt: true,
	scene: [GameScene],
	render: {
		transparent: true,
		pipeline: {
			'Glitch': GlitchPostFxPipeline,
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);

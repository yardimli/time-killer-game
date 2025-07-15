// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	width: 320,
	height: 240,
	scale: {
		mode: Phaser.Scale.RESIZE,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	parent: 'phaser-example',
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

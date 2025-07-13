// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	scale: {
		mode: Phaser.Scale.RESIZE,
		parent: 'phaser-example',
		width: '100%',
		height: '100%'
	},
	// --- MODIFICATION: Switched to Matter.js Physics ---
	// The physics engine has been changed from 'arcade' to 'matter'.
	// The configuration object is now for Matter.js, with gravity
	// set to zero and the helpful visual debugger enabled.
	physics: {
		default: 'matter',
		matter: {
			gravity: { y: 0 },
			debug: false // Shows Matter.js physics bodies, vectors, and collisions.
		}
	},
	// --- END MODIFICATION ---
	pixelArt: true,
	scene: [BoardSetupScene, BoardViewScene, BallScene],
	render: {
		pipeline: {
			'Glitch': GlitchPostFxPipeline
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);

// --- Phaser Game Configuration ---
const config = {
	type: Phaser.WEBGL,
	scale: {
		mode: Phaser.Scale.RESIZE,
		parent: 'phaser-example',
		width: '100%',
		height: '100%'
	},
	pixelArt: true,
	scene: [BoardSetupScene, BoardViewScene],
	render: {
		pipeline: {
			'Glitch': GlitchPostFxPipeline
		}
	}
};

// --- Create the Game Instance ---
const game = new Phaser.Game(config);

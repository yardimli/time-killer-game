/**
 * @file Centralized configuration for the entire Phaser game.
 * This file contains setup variables for game mechanics, UI, and scene-specific behaviors.
 */

// --- NEW FILE: Centralized Game Configuration ---
const GAME_CONFIG = {
	// Shared values used across multiple scenes
	Shared: {
		PIXEL_SCALE: 2,
		SELECTOR_SCREEN_WIDTH: 100,
		SCORE_SCREEN_HEIGHT: 60,
		// Master list of all possible ball colors
		BALL_COLORS: [
			'#FF0000', // Red
			'#FFA500', // Orange
			'#FFFF00', // Yellow
			'#00FF00', // Green
			'#0000FF', // Blue
			'#4B0082', // Indigo
			'#EE82EE'  // Violet
		]
	},
	
	// Configuration for BallScene
	BallScene: {
		defaultMaxBalls: 3,
		lifespan: 120000,
		fadeDuration: 1500,
		respawnDelay: 1000,
		initialSize: 0.1,
		finalSize: 0.8,
		dropDuration: 700,
		pixelSize: 35,
		frictionAir: 0.05,
		restitution: 0.8,
		organicMoveThreshold: 0.6,
		organicMoveForce: 0.00005
	},
	
	// Configuration for BoardSetupScene
	BoardSetupScene: {
		SELECTOR_PIXEL_WIDTH: 40,
		SLOT_PIXEL_HEIGHT: 30,
		NUM_ICONS: 4
	},
	
	// Configuration for BoardViewScene
	BoardViewScene: {
		BOARD_PIXEL_WIDTH: 300,
		BOARD_PIXEL_HEIGHT: 300,
		// NEW: Added a background color for the main play area.
		backgroundColor: '#333333',
		// Set to true to enable debug drawing of the playAreaPolygon and goal sensors.
		debugDraw: false,
		glitchConfig: {
			stretch: { minSize: 0.4, maxSize: 1.0, minDuration: 50, maxDuration: 500, minDelay: 400, maxDelay: 2500 },
			border: {
				minLength: 15,
				maxLength: 150,
				minDuration: 300,
				maxDuration: 1500,
				minDelay: 100,
				maxDelay: 500,
				color: '#555555'
			}
		},
		goalConfig: {
			width: 100,
			depth: 60,
			chamfer: 8,
			dashLength: 3,
			gapLength: 3
		}
	},
	
	// Configuration for ScoreScene (can be expanded later)
	ScoreScene: {
		// Example: textStyle: { font: '20px monospace', fill: '#ffffff' }
	}
};

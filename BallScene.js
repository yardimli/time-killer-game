// --- Scene 3: The Ball Manager ---
class BallScene extends Phaser.Scene {
	constructor() {
		super({ key: 'BallScene', active: true });
		// --- Configuration for Balls ---
		this.ballConfig = {
			colors: [], // Will be populated by an event from BoardSetupScene.
			maxBalls: 3, // The maximum number of balls on screen at once.
			lifespan: 8000, // Time in ms before a ball starts to fade out.
			fadeDuration: 500, // Time in ms for the fade out animation.
			respawnDelay: 1000, // Time in ms after a ball is destroyed before a new one spawns.
			initialSize: 0.1, // The ball's scale when it first appears.
			finalSize: 0.8, // The ball's final scale after dropping.
			dropDuration: 700, // Time in ms for the drop animation.
			pixelSize: 20, // The radius of the ball texture in pixels.
			drag: 0.98, // The air resistance for physics.
			bounce: 0.8, // The bounciness of the balls.
			maxVelocity: 200, // The maximum speed a ball can travel.
			organicMoveThreshold: 20, // Speed below which a new "nudge" is applied.
			organicMoveForce: 50 // The force of the organic movement "nudge".
		};
		
		this.balls = null; // The physics group for all balls.
		this.boardViewScene = null; // A reference to the BoardViewScene.
	}
	
	create() {
		console.log('BallScene: create()');
		this.boardViewScene = this.scene.get('BoardViewScene');
		
		// Match this scene's camera to the BoardViewScene's camera viewport.
		this.cameras.main.setViewport(
			this.boardViewScene.cameras.main.x,
			this.boardViewScene.cameras.main.y,
			this.boardViewScene.cameras.main.width,
			this.boardViewScene.cameras.main.height
		);
		
		// Create a physics group for the balls with default physics properties.
		this.balls = this.physics.add.group({
			bounceX: this.ballConfig.bounce,
			bounceY: this.ballConfig.bounce,
			dragX: this.ballConfig.drag,
			dragY: this.ballConfig.drag,
			maxVelocity: { x: this.ballConfig.maxVelocity, y: this.ballConfig.maxVelocity }
		});
		
		// Set up collision between balls themselves.
		this.physics.add.collider(this.balls, this.balls);
		
		// Set up collision between balls and the walls from BoardViewScene.
		// This will now work correctly because this scene is only started *after*
		// the boardViewScene.walls group has been created.
		console.log('walls',this.boardViewScene.walls);
		this.physics.add.collider(this.balls, this.boardViewScene.walls);
		
		// Listen for board configuration changes to get colors and trigger a reset.
		this.game.events.on('boardConfigurationChanged', (config) => {
			this.ballConfig.colors = config.colors;
			this.createBallTextures(); // Create textures for the new colors.
			this.resetBalls(); // Clear old balls and spawn new ones.
		}, this);
		
		// Handle user dragging balls.
		this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
			gameObject.setPosition(dragX, dragY);
		});
		this.input.on('dragstart', (pointer, gameObject) => {
			gameObject.body.setImmovable(true);
			gameObject.body.setVelocity(0, 0);
		});
		this.input.on('dragend', (pointer, gameObject) => {
			gameObject.body.setImmovable(false);
			// Give the ball a flick based on the drag velocity.
			gameObject.body.setVelocity(pointer.velocity.x * 10, pointer.velocity.y * 10);
		});
		
		// Handle window resize to keep camera viewports in sync.
		this.scale.on('resize', (gameSize) => {
			this.cameras.main.setViewport(
				this.boardViewScene.cameras.main.x,
				this.boardViewScene.cameras.main.y,
				this.boardViewScene.cameras.main.width,
				this.boardViewScene.cameras.main.height
			);
		}, this);
	}
	
	update(time, delta) {
		// Apply slow, organic movement to balls that have nearly stopped.
		this.balls.getChildren().forEach(ball => {
			if (!ball.body || ball.body.immovable) return;
			
			const speed = ball.body.velocity.length();
			if (speed < this.ballConfig.organicMoveThreshold) {
				const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
				const force = this.ballConfig.organicMoveForce;
				ball.body.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
			}
		});
	}
	
	createBallTextures() {
		this.ballConfig.colors.forEach((color, index) => {
			const textureKey = `ball_${index}`;
			const size = this.ballConfig.pixelSize * 2;
			
			if (this.textures.exists(textureKey)) {
				this.textures.remove(textureKey);
			}
			
			const gfx = this.add.graphics().setVisible(false);
			
			gfx.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
			gfx.fillCircle(size / 2, size / 2, size / 2);
			
			const highlightColor = Phaser.Display.Color.ValueToColor(color).lighten(50).color;
			gfx.fillStyle(highlightColor, 1);
			gfx.fillCircle(size * 0.4, size * 0.4, size * 0.2);
			
			gfx.generateTexture(textureKey, size, size);
			gfx.destroy();
		});
	}
	
	resetBalls() {
		this.balls.getChildren().forEach(ball => {
			if (ball.lifespanTimer) ball.lifespanTimer.remove();
			this.tweens.killTweensOf(ball);
		});
		this.balls.clear(true, true);
		
		for (let i = 0; i < this.ballConfig.maxBalls; i++) {
			this.spawnBall();
		}
	}
	
	spawnBall() {
		if (this.balls.countActive(true) >= this.ballConfig.maxBalls || this.ballConfig.colors.length === 0) {
			return;
		}
		
		if (!this.boardViewScene.playAreaPolygon) {
			this.time.delayedCall(50, this.spawnBall, [], this);
			return;
		}
		
		// Get a random point inside the arena polygon for the ball to land on.
		const targetPoint = this.getRandomPointInPolygon(this.boardViewScene.playAreaPolygon);
		
		// If the polygon is invalid (e.g., has no area), we can't spawn a ball.
		if (!targetPoint) {
			console.warn('Could not find a valid spawn point in the polygon.');
			return;
		}
		
		const spawnX = targetPoint.x;
		const spawnY = this.cameras.main.worldView.y - 50;
		
		const colorIndex = Phaser.Math.Between(0, this.ballConfig.colors.length - 1);
		const textureKey = `ball_${colorIndex}`;
		
		const ball = this.balls.create(spawnX, spawnY, textureKey);
		ball.setCircle(this.ballConfig.pixelSize);
		ball.setScale(this.ballConfig.initialSize);
		ball.setOrigin(0.5, 0.5);
		ball.body.setEnable(false);
		
		this.input.setDraggable(ball.setInteractive());
		
		this.tweens.add({
			targets: ball,
			y: targetPoint.y,
			scale: this.ballConfig.finalSize,
			duration: this.ballConfig.dropDuration,
			ease: 'Bounce.easeOut',
			onComplete: () => {
				if (!ball.active) return;
				ball.body.setEnable(true);
				ball.lifespanTimer = this.time.delayedCall(this.ballConfig.lifespan, this.fadeAndDestroyBall, [ball], this);
			}
		});
	}
	
	fadeAndDestroyBall(ball) {
		if (!ball.active) return;
		
		this.tweens.add({
			targets: ball,
			alpha: 0,
			duration: this.ballConfig.fadeDuration,
			ease: 'Power2',
			onComplete: () => {
				ball.destroy();
				this.time.delayedCall(this.ballConfig.respawnDelay, this.spawnBall, [], this);
			}
		});
	}
	
	/**
	 * Calculates a random point uniformly distributed within a convex polygon.
	 * This works by breaking the polygon into a "fan" of triangles, picking one
	 * weighted by its area, and then finding a random point in that triangle.
	 * @param {Phaser.Geom.Polygon} polygon - The convex polygon to find a point in.
	 * @returns {Phaser.Geom.Point|null} A point object {x, y} or null if the polygon is invalid.
	 */
	getRandomPointInPolygon(polygon) {
		if (!polygon || !polygon.points || polygon.points.length < 3) {
			return null;
		}
		
		const vertices = polygon.points;
		const centralVertex = vertices[0];
		const triangles = [];
		let totalArea = 0;
		
		// 1. Create a "fan" of triangles using the first vertex as a common point.
		for (let i = 1; i < vertices.length - 1; i++) {
			const p1 = centralVertex;
			const p2 = vertices[i];
			const p3 = vertices[i + 1];
			
			// Use Phaser's built-in function to calculate the area of the triangle.
			const area = Phaser.Geom.Triangle.Area(new Phaser.Geom.Triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y));
			
			triangles.push({ p1, p2, p3, area });
			totalArea += area;
		}
		
		if (totalArea <= 0) {
			// This can happen if the polygon is degenerate (e.g., all points on a line).
			return new Phaser.Geom.Point(centralVertex.x, centralVertex.y);
		}
		
		// 2. Choose a triangle, weighted by its area.
		let randomArea = Math.random() * totalArea;
		let chosenTriangle = null;
		
		for (const triangle of triangles) {
			if (randomArea < triangle.area) {
				chosenTriangle = triangle;
				break;
			}
			randomArea -= triangle.area;
		}
		// As a fallback for floating point inaccuracies, grab the last triangle.
		if (!chosenTriangle) {
			chosenTriangle = triangles[triangles.length - 1];
		}
		
		// 3. Get a random point within the chosen triangle using barycentric coordinates.
		let r1 = Math.random();
		let r2 = Math.random();
		
		// This transform ensures the point is uniformly distributed within the triangle.
		if (r1 + r2 > 1) {
			r1 = 1.0 - r1;
			r2 = 1.0 - r2;
		}
		
		const { p1, p2, p3 } = chosenTriangle;
		const x = p1.x + r1 * (p2.x - p1.x) + r2 * (p3.x - p1.x);
		const y = p1.y + r1 * (p2.y - p1.y) + r2 * (p3.y - p1.y);
		
		return new Phaser.Geom.Point(x, y);
	}
}

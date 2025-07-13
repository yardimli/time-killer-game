// --- Scene 3: The Ball Manager ---
class BallScene extends Phaser.Scene {
	constructor() {
		super({key: 'BallScene', active: false});
		
		this.ballConfig = {...GAME_CONFIG.BallScene};
		// These properties are set dynamically when the board configuration changes.
		this.ballConfig.colors = [];
		this.ballConfig.maxBalls = this.ballConfig.defaultMaxBalls;
		
		this.balls = null;
		this.boardViewScene = null;
		this.walls = null;
		this.goals = [];
	}
	
	preload() {
		console.log('BallScene: preload()');
		
		this.load.audio('drop', 'assets/audio/DSGNBass_Smooth Sub Drop Bass Downer.wav');
		this.load.audio('bounce1', 'assets/audio/basketball_bounce_single_3.wav');
		this.load.audio('bounce2', 'assets/audio/basketball_bounce_single_5.wav');
		this.load.audio('bounce3', 'assets/audio/Vintage Bounce.wav');
		
		this.load.audio('click', 'assets/audio/Item Pick Up.wav');
		this.load.audio('drop_valid', 'assets/audio/Drop Game Potion.wav');
		this.load.audio('drop_invalid', 'assets/audio/Hit Item Dropped 2.wav');
	}
	
	create() {
		console.log('BallScene: create()');
		this.boardViewScene = this.scene.get('BoardViewScene');
		
		this.cameras.main.setViewport(
			this.boardViewScene.cameras.main.x,
			this.boardViewScene.cameras.main.y,
			this.boardViewScene.cameras.main.width,
			this.boardViewScene.cameras.main.height
		);
		
		this.balls = this.add.group();
		this.walls = this.add.group();
		
		this.game.events.on('boardConfigurationChanged', (config) => {
			this.ballConfig.colors = config.colors;
			this.ballConfig.maxBalls = config.sides;
			this.goals = config.goals;
			this.createBallTextures();
			this.createWallsFromPolygon();
			this.resetBalls();
		}, this);
		
		this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
			gameObject.setPosition(dragX, dragY);
		});
		
		this.input.on('dragstart', (pointer, gameObject) => {
			this.sound.play('click', {volume: 0.5});
			gameObject.setStatic(true);
		});
		
		// --- MODIFIED SECTION: Updated dragend logic ---
		this.input.on('dragend', (pointer, gameObject) => {
			const playArea = this.boardViewScene.playAreaPolygon;
			const goalSensors = this.boardViewScene.goalSensors;
			
			// A drop is valid if it's inside the main play area polygon...
			let isValidDrop = playArea && Phaser.Geom.Polygon.Contains(playArea, pointer.x, pointer.y);
			let isGoalDrop = false;
			
			// ...or if it's inside one of the goal sensor areas.
			for (const sensor of goalSensors) {
				// Matter bodies have a 'vertices' property with world-space coordinates.
				// We can create a temporary polygon from these to check for containment.
				const sensorPolygon = new Phaser.Geom.Polygon(sensor.vertices);
				if (Phaser.Geom.Polygon.Contains(sensorPolygon, pointer.x, pointer.y)) {
					isValidDrop = true;
					isGoalDrop = true;
					console.log('Valid drop inside goal sensor:', sensor);
					
					const ball = gameObject;
					
					// Ensure the ball is a valid, active game object before processing
					if (ball && ball.active) {
						// Check if the ball's color matches the goal's assigned color
						if (ball.color === sensor.color) {
							// --- CORRECT GOAL ---
							this.sound.play('drop_valid', {volume: 0.6});
							this.game.events.emit('scorePoint', {color: ball.color});
							this.fadeAndDestroyBall(ball);
						} else {
							// --- WRONG GOAL ---
							this.sound.play('drop_invalid', {volume: 0.6});
							this.fadeAndDestroyBall(ball);
						}
					}
					
					break; // Found a valid drop location, no need to check other goals.
				}
			}
			
			
			if (isValidDrop && !isGoalDrop) {
				// --- VALID DROP ---
				this.sound.play('drop', {volume: 0.6});
				// Make the ball dynamic again so it can collide with the goal sensor.
				gameObject.setStatic(false);
				// Apply velocity from the drag release.
				gameObject.setVelocity(pointer.velocity.x / 5, pointer.velocity.y / 5);
			} else if (!isValidDrop && !isGoalDrop) {
				// --- INVALID DROP ---
				this.sound.play('drop_invalid', {volume: 0.6});
				
				if (gameObject.active) {
					this.fadeAndDestroyBall(gameObject);
				}
			}
		});
		
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
		this.balls.getChildren().forEach(ball => {
			if (!ball.body || ball.isStatic()) return;
			
			if (Math.random() > this.ballConfig.organicMoveThreshold) {
				const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
				const force = new Phaser.Math.Vector2(
					Math.cos(angle) * this.ballConfig.organicMoveForce,
					Math.sin(angle) * this.ballConfig.organicMoveForce
				);
				ball.applyForce(force);
			}
		});
	}
	
	createWallsFromPolygon() {
		this.walls.clear(true, true);
		
		const playArea = this.boardViewScene.playArea;
		if (!playArea || !playArea.center || !playArea.vertices || playArea.vertices.length < 2) {
			console.warn('Cannot create walls, playArea data is invalid.');
			return;
		}
		
		const localVertices = playArea.vertices;
		const wallThickness = 10;
		
		for (let i = 0; i < localVertices.length; i++) {
			const p1_local = localVertices[i];
			const p2_local = localVertices[(i + 1) % localVertices.length];
			
			const p1_world = {x: playArea.center.x + p1_local.x, y: playArea.center.y + p1_local.y};
			const p2_world = {x: playArea.center.x + p2_local.x, y: playArea.center.y + p2_local.y};
			
			const length = Phaser.Math.Distance.BetweenPoints(p1_world, p2_world);
			const angle = Phaser.Math.Angle.BetweenPoints(p1_world, p2_world);
			const centerX = (p1_world.x + p2_world.x) / 2;
			const centerY = (p1_world.y + p2_world.y) / 2;
			
			const wallSegmentGO = this.add.rectangle(centerX, centerY, length, wallThickness);
			
			this.matter.add.gameObject(wallSegmentGO, {
				isStatic: true,
				restitution: 0.5,
				friction: 0.1
			});
			
			wallSegmentGO.setRotation(angle);
			wallSegmentGO.setVisible(false);
			this.walls.add(wallSegmentGO);
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
		const targetPoint = this.getRandomPointInPolygon(this.boardViewScene.playAreaPolygon);
		if (!targetPoint) {
			console.warn('Could not find a valid spawn point in the polygon.');
			return;
		}
		const spawnX = targetPoint.x;
		const spawnY = this.cameras.main.worldView.y - 50;
		const colorIndex = Phaser.Math.Between(0, this.ballConfig.colors.length - 1);
		const textureKey = `ball_${colorIndex}`;
		const ballColor = this.ballConfig.colors[colorIndex];
		
		const ball = this.matter.add.image(spawnX, spawnY, textureKey, null, {
			shape: {type: 'circle', radius: this.ballConfig.pixelSize},
			restitution: this.ballConfig.restitution,
			frictionAir: this.ballConfig.frictionAir,
			label: 'ball'
		});
		this.balls.add(ball);
		ball.color = ballColor;
		
		ball.setScale(this.ballConfig.initialSize);
		ball.setOrigin(0.5, 0.5);
		ball.setStatic(true);
		this.input.setDraggable(ball.setInteractive());
		
		this.tweens.add({
			targets: ball,
			y: targetPoint.y,
			scale: this.ballConfig.finalSize,
			duration: this.ballConfig.dropDuration,
			ease: 'Bounce.easeOut',
			onStart: () => {
				this.sound.play('drop', {volume: 0.7});
			},
			onComplete: () => {
				if (!ball.active) return;
				
				
				ball.setStatic(false);
				
				const initialSpeed = Phaser.Math.FloatBetween(2, 5);
				const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
				
				const velocityX = Math.cos(angle) * initialSpeed;
				const velocityY = Math.sin(angle) * initialSpeed;
				
				ball.setVelocity(velocityX, velocityY);
				
				ball.lifespanTimer = this.time.delayedCall(this.ballConfig.lifespan, this.fadeAndDestroyBall, [ball], this);
			}
		});
	}
	
	createBallTextures() {
		this.ballConfig.colors.forEach((color, index) => {
			const textureKey = `ball_${index}`;
			const size = this.ballConfig.pixelSize * 2;
			const radius = size / 2;
			
			if (this.textures.exists(textureKey)) {
				this.textures.remove(textureKey);
			}
			
			const canvas = this.textures.createCanvas(textureKey, size, size);
			if (!canvas) return;
			const ctx = canvas.getContext();
			
			const highlightX = radius * 0.7;
			const highlightY = radius * 0.7;
			const gradient = ctx.createRadialGradient(
				highlightX,
				highlightY,
				radius * 0.05,
				radius,
				radius,
				radius
			);
			
			const baseColor = Phaser.Display.Color.HexStringToColor(color);
			const lightColor = Phaser.Display.Color.ValueToColor(color).lighten(75);
			const darkColor = Phaser.Display.Color.ValueToColor(color).darken(50);
			
			gradient.addColorStop(0, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 1)`);
			gradient.addColorStop(0.8, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 1)`);
			gradient.addColorStop(1, `rgba(${darkColor.r}, ${darkColor.g}, ${darkColor.b}, 1)`);
			
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(radius, radius, radius, 0, Math.PI * 2);
			ctx.fill();
			
			canvas.refresh();
		});
	}
	
	resetBalls() {
		this.balls.getChildren().forEach(ball => {
			if (ball.lifespanTimer) ball.lifespanTimer.remove();
			this.tweens.killTweensOf(ball);
		});
		this.balls.clear(true, true);
		
		let ball_delay = 0;
		for (let i = 0; i < this.ballConfig.maxBalls; i++) {
			const delay = Phaser.Math.Between(1000, 2000);
			ball_delay += delay;
			this.time.delayedCall(ball_delay, () => {
				this.spawnBall();
			});
		}
	}
	
	fadeAndDestroyBall(ball) {
		if (!ball.active) return;
		ball.setActive(false);
		
		this.tweens.add({
			targets: ball,
			alpha: 0,
			duration: this.ballConfig.fadeDuration,
			ease: 'Power2',
			onComplete: () => {
				this.balls.remove(ball, true, true);
				this.time.delayedCall(this.ballConfig.respawnDelay, this.spawnBall, [], this);
			}
		});
	}
	
	getRandomPointInPolygon(polygon) {
		if (!polygon || !polygon.points || polygon.points.length < 3) {
			return null;
		}
		const vertices = polygon.points;
		const centralVertex = vertices[0];
		const triangles = [];
		let totalArea = 0;
		for (let i = 1; i < vertices.length - 1; i++) {
			const p1 = centralVertex;
			const p2 = vertices[i];
			const p3 = vertices[i + 1];
			const area = Phaser.Geom.Triangle.Area(new Phaser.Geom.Triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y));
			triangles.push({p1, p2, p3, area});
			totalArea += area;
		}
		if (totalArea <= 0) {
			return new Phaser.Geom.Point(centralVertex.x, centralVertex.y);
		}
		let randomArea = Math.random() * totalArea;
		let chosenTriangle = null;
		for (const triangle of triangles) {
			if (randomArea < triangle.area) {
				chosenTriangle = triangle;
				break;
			}
			randomArea -= triangle.area;
		}
		if (!chosenTriangle) {
			chosenTriangle = triangles[triangles.length - 1];
		}
		let r1 = Math.random();
		let r2 = Math.random();
		if (r1 + r2 > 1) {
			r1 = 1.0 - r1;
			r2 = 1.0 - r2;
		}
		const {p1, p2, p3} = chosenTriangle;
		const x = p1.x + r1 * (p2.x - p1.x) + r2 * (p3.x - p1.x);
		const y = p1.y + r1 * (p2.y - p1.y) + r2 * (p3.y - p1.y);
		return new Phaser.Geom.Point(x, y);
	}
}

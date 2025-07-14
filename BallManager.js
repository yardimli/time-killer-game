// --- The Ball Manager ---
class BallManager {
	constructor(scene, boardView) {
		this.scene = scene; // Store a reference to the main scene.
		this.boardView = boardView; // Store a reference to the board view manager.
		
		this.ballConfig = { ...GAME_CONFIG.BallScene };
		// These properties are set dynamically when the board configuration changes.
		this.ballConfig.colors = [];
		this.ballConfig.maxBalls = this.ballConfig.defaultMaxBalls;
		
		this.balls = null;
		this.walls = null;
		this.goals = [];
	}
	
	init() {
		console.log('BallManager: init()');
		
		this.balls = this.scene.add.group();
		this.walls = this.scene.add.group();
		
		this.scene.game.events.on('boardConfigurationChanged', (config) => {
			this.ballConfig.colors = config.colors;
			this.ballConfig.maxBalls = config.sides;
			this.goals = config.goals;
			this.createBallTextures();
			this.createWallsFromPolygon();
			this.resetBalls();
		}, this);
		
		this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => { gameObject.setPosition(dragX, dragY); });
		
		this.scene.input.on('dragstart', (pointer, gameObject) => {
			this.scene.sound.play('click', { volume: 0.5 });
			gameObject.setStatic(true);
			
			this.scene.children.bringToTop(gameObject);
			
			this.scene.tweens.add({
				targets: gameObject,
				scale: this.ballConfig.finalSize * 0.75,
				duration: 150,
				ease: 'Power2'
			});
		});
		
		// --- MODIFICATION START ---
		// The dragend logic is updated to create a "drop and bounce" effect.
		this.scene.input.on('dragend', (pointer, gameObject) => {
			this.scene.tweens.killTweensOf(gameObject);
			
			const playArea = this.boardView.playAreaPolygon;
			const goalSensors = this.boardView.goalSensors;
			
			const dropX = gameObject.x;
			const dropY = gameObject.y;
			
			let isValidDrop = false;
			let isGoalDrop = false;
			let hitSensor = null;
			
			if (goalSensors && goalSensors.length > 0) {
				const point = { x: dropX, y: dropY };
				console.log('Checking drop point:', point);
				const bodiesUnderPoint = this.scene.matter.query.point(goalSensors, point);
				
				if (bodiesUnderPoint.length > 0) {
					hitSensor = bodiesUnderPoint[0];
					isValidDrop = true;
					isGoalDrop = true;
				}
			}
			
			if (!isGoalDrop && playArea) {
				if (Phaser.Geom.Polygon.Contains(playArea, pointer.x, pointer.y)) {
					isValidDrop = true;
				}
			}
			
			if (isGoalDrop) {
				console.log('Valid drop inside goal sensor:', hitSensor);
				const ball = gameObject;
				
				if (ball && ball.active) {
					if (ball.color === hitSensor.color) {
						// --- MODIFICATION START ---
						// The original logic is replaced with a new animation sequence.
						this.scene.sound.play('drop_valid', { volume: 0.6 });
						
						// Prevent the ball from being dragged or affected by physics during the animation.
						ball.setStatic(true);
						ball.setActive(false); // Also set inactive to be safe.
						
						// Get the target coordinates from the BottomScore manager.
						const targetInfo = this.scene.bottomScore.getBarAnimationInfo(ball.color);
						
						if (targetInfo) {
							// Tell the BottomScore UI to start its "drawer open" animation.
							this.scene.game.events.emit('startGoalAnimation', { color: ball.color });
							
							// Animate the ball flying into the score bar.
							this.scene.tweens.add({
								targets: ball,
								x: targetInfo.x,
								y: targetInfo.y,
								scale: 0, // Shrink the ball as it enters the "gate".
								duration: 400,
								ease: 'Cubic.easeIn',
								delay: 250, // Wait for the drawer animation to play out a bit.
								onComplete: () => {
									// Once the ball arrives at the destination:
									// 1. Officially score the point.
									this.scene.game.events.emit('scorePoint', { color: ball.color });
									
									// 2. Tell the BottomScore UI to close the drawer.
									this.scene.game.events.emit('endGoalAnimation', { color: ball.color });
									
									// 3. Clean up the ball object and schedule a new one to spawn.
									this.balls.remove(ball, true, true);
									this.scene.time.delayedCall(this.ballConfig.respawnDelay, this.spawnBall, [], this);
								}
							});
						} else {
							// Fallback in case the animation target can't be found.
							// This preserves the original scoring behavior.
							this.scene.game.events.emit('scorePoint', { color: ball.color });
							this.fadeAndDestroyBall(ball);
						}
						// --- MODIFICATION END ---
					} else {
						this.scene.sound.play('drop_invalid', { volume: 0.6 });
						this.fadeAndDestroyBall(ball);
					}
				}
			} else if (isValidDrop) {
				this.scene.sound.play('click_drop', { volume: 0.6 });
				
				// To create a "fall" effect, we slightly lift the ball before dropping it.
				const finalDropY = gameObject.y;
				gameObject.y -= 20; // Lift it up a bit.
				
				// Animate the ball dropping down with a bounce.
				this.scene.tweens.add({
					targets: gameObject,
					y: finalDropY, // Animate to the original drop position.
					duration: 600,
					ease: 'Bounce.easeOut',
					onComplete: () => {
						// Only make the ball dynamic after the drop animation is complete.
						if (gameObject.active) {
							gameObject.setStatic(false);
							gameObject.setVelocity(pointer.velocity.x / 5, pointer.velocity.y / 5);
						}
					}
				});
				
				// Concurrently, animate the scale back to its normal size.
				this.scene.tweens.add({
					targets: gameObject,
					scale: this.ballConfig.finalSize,
					duration: 250,
					ease: 'Sine.easeOut'
				});
			} else {
				this.scene.sound.play('drop_invalid', { volume: 0.6 });
				if (gameObject.active) {
					this.fadeAndDestroyBall(gameObject);
				}
			}
		});
		// --- MODIFICATION END ---
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
		
		const playArea = this.boardView.playArea;
		if (!playArea || !playArea.center || !playArea.vertices || playArea.vertices.length < 2) {
			console.warn('Cannot create walls, playArea data is invalid.');
			return;
		}
		
		const localVertices = playArea.vertices;
		const wallThickness = 10;
		
		for (let i = 0; i < localVertices.length; i++) {
			const p1_local = localVertices[i];
			const p2_local = localVertices[(i + 1) % localVertices.length];
			
			const p1_world = { x: playArea.center.x + p1_local.x, y: playArea.center.y + p1_local.y };
			const p2_world = { x: playArea.center.x + p2_local.x, y: playArea.center.y + p2_local.y };
			
			const length = Phaser.Math.Distance.BetweenPoints(p1_world, p2_world);
			const angle = Phaser.Math.Angle.BetweenPoints(p1_world, p2_world);
			const centerX = (p1_world.x + p2_world.x) / 2;
			const centerY = (p1_world.y + p2_world.y) / 2;
			
			const wallSegmentGO = this.scene.add.rectangle(centerX, centerY, length, wallThickness);
			
			this.scene.matter.add.gameObject(wallSegmentGO, {
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
		if (this.balls.countActive(true) >= this.ballConfig.maxBalls || this.ballConfig.colors.length === 0) { return; }
		if (!this.boardView.playAreaPolygon) {
			this.scene.time.delayedCall(50, this.spawnBall, [], this);
			return;
		}
		const targetPoint = this.getRandomPointInPolygon(this.boardView.playAreaPolygon);
		if (!targetPoint) {
			console.warn('Could not find a valid spawn point in the polygon.');
			return;
		}
		const spawnX = targetPoint.x;
		const spawnY = -50;
		const colorIndex = Phaser.Math.Between(0, this.ballConfig.colors.length - 1);
		const textureKey = `ball_${colorIndex}`;
		const ballColor = this.ballConfig.colors[colorIndex];
		
		const ball = this.scene.matter.add.image(spawnX, spawnY, textureKey, null, {
			shape: { type: 'circle', radius: this.ballConfig.pixelSize },
			restitution: this.ballConfig.restitution,
			frictionAir: this.ballConfig.frictionAir,
			label: 'ball'
		});
		this.balls.add(ball);
		ball.color = ballColor;
		
		ball.setScale(this.ballConfig.initialSize);
		ball.setOrigin(0.5, 0.5);
		ball.setStatic(true);
		this.scene.input.setDraggable(ball.setInteractive());
		
		this.scene.tweens.add({
			targets: ball,
			y: targetPoint.y,
			scale: this.ballConfig.finalSize,
			duration: this.ballConfig.dropDuration,
			ease: 'Bounce.easeOut',
			onStart: () => {
				this.scene.sound.play('drop', { volume: 0.7 });
			},
			onComplete: () => {
				if (!ball.active) return;
				
				ball.setStatic(false);
				
				const initialSpeed = Phaser.Math.FloatBetween(2, 5);
				const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
				
				const velocityX = Math.cos(angle) * initialSpeed;
				const velocityY = Math.sin(angle) * initialSpeed;
				
				ball.setVelocity(velocityX, velocityY);
				
				ball.lifespanTimer = this.scene.time.delayedCall(this.ballConfig.lifespan, this.fadeAndDestroyBall, [ball], this);
			}
		});
	}
	
	createBallTextures() {
		this.ballConfig.colors.forEach((color, index) => {
			const textureKey = `ball_${index}`;
			const size = this.ballConfig.pixelSize * 2;
			const radius = size / 2;
			
			if (this.scene.textures.exists(textureKey)) {
				this.scene.textures.remove(textureKey);
			}
			
			const canvas = this.scene.textures.createCanvas(textureKey, size, size);
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
			this.scene.tweens.killTweensOf(ball);
		});
		this.balls.clear(true, true);
		
		let ball_delay = 0;
		for (let i = 0; i < this.ballConfig.maxBalls; i++) {
			const delay = Phaser.Math.Between(1000, 2000);
			ball_delay += delay;
			this.scene.time.delayedCall(ball_delay, () => {
				this.spawnBall();
			});
		}
	}
	
	fadeAndDestroyBall(ball) {
		if (!ball.active) return;
		ball.setActive(false);
		
		this.scene.tweens.add({
			targets: ball,
			alpha: 0,
			duration: this.ballConfig.fadeDuration,
			ease: 'Power2',
			onComplete: () => {
				this.balls.remove(ball, true, true);
				this.scene.time.delayedCall(this.ballConfig.respawnDelay, this.spawnBall, [], this);
			}
		});
	}
	
	getRandomPointInPolygon(polygon) {
		if (!polygon || !polygon.points || polygon.points.length < 3) { return null; }
		const vertices = polygon.points;
		const centralVertex = vertices[0];
		const triangles = [];
		let totalArea = 0;
		for (let i = 1; i < vertices.length - 1; i++) {
			const p1 = centralVertex;
			const p2 = vertices[i];
			const p3 = vertices[i + 1];
			const area = Phaser.Geom.Triangle.Area(new Phaser.Geom.Triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y));
			triangles.push({ p1, p2, p3, area });
			totalArea += area;
		}
		if (totalArea <= 0) { return new Phaser.Geom.Point(centralVertex.x, centralVertex.y); }
		let randomArea = Math.random() * totalArea;
		let chosenTriangle = null;
		for (const triangle of triangles) {
			if (randomArea < triangle.area) {
				chosenTriangle = triangle;
				break;
			}
			randomArea -= triangle.area;
		}
		if (!chosenTriangle) { chosenTriangle = triangles[triangles.length - 1]; }
		let r1 = Math.random();
		let r2 = Math.random();
		if (r1 + r2 > 1) { r1 = 1.0 - r1; r2 = 1.0 - r2; }
		const { p1, p2, p3 } = chosenTriangle;
		const x = p1.x + r1 * (p2.x - p1.x) + r2 * (p3.x - p1.x);
		const y = p1.y + r1 * (p2.y - p1.y) + r2 * (p3.y - p1.y);
		return new Phaser.Geom.Point(x, y);
	}
}

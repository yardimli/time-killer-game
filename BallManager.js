// --- The Ball Manager ---
class BallManager {
	constructor(scene, boardView) {
		this.scene = scene; // Store a reference to the main scene.
		this.boardView = boardView; // Store a reference to the board view manager.
		
		this.ballConfig = {...GAME_CONFIG.BallScene};
		// Adjusted physics parameters for stable dragging
		this.ballConfig.dragStiffness = 0.01; // How strongly the ball follows the cursor (0-1)
		this.ballConfig.dragDamping = 0.9; // Velocity damping while dragging (0-1)
		this.ballConfig.maxDragVelocity = 10; // Maximum velocity while dragging
		
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
		
		// --- Improved Physics-based Dragging Logic ---
		this.scene.input.on('dragstart', (pointer, gameObject) => {
			// Ensure we are only dragging balls that have a physics body.
			if (!gameObject.body || gameObject.body.label !== 'ball') return;
			
			this.scene.sound.play('click', {volume: 0.5});
			
			// The ball remains a dynamic physics object.
			gameObject.originalFrictionAir = gameObject.body.frictionAir;
			gameObject.setFrictionAir(0.1); // Increased air friction for better control
			gameObject.isDragging = true;
			
			// Store the drag offset to maintain relative position
			gameObject.dragOffsetX = gameObject.x - pointer.x;
			gameObject.dragOffsetY = gameObject.y - pointer.y;
			
			this.scene.children.bringToTop(gameObject);
			
			gameObject.setStatic(true);
			this.scene.tweens.add({
				targets: gameObject,
				scale: this.ballConfig.finalSize * 0.75,
				duration: 150,
				ease: 'Power2',
				onComplete: () => {
					gameObject.setStatic(false);
				}
			});
		});
		
		this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
			// Ensure we are only dragging balls.
			if (!gameObject.body || gameObject.body.label !== 'ball') return;
			
			// Calculate the desired position
			const targetX = dragX;
			const targetY = dragY;
			
			// Calculate the difference between current and target position
			const dx = targetX - gameObject.x;
			const dy = targetY - gameObject.y;
			
			// Apply a spring-like force proportional to the distance
			// This creates a smooth following effect
			const forceX = dx * this.ballConfig.dragStiffness;
			const forceY = dy * this.ballConfig.dragStiffness;
			
			// Set velocity directly for more control (instead of applying force)
			gameObject.setVelocity(
				forceX * 60, // Multiply by 60 to convert to per-second units
				forceY * 60
			);
			
			// Apply velocity damping to prevent oscillation
			const currentVelocity = gameObject.body.velocity;
			const speed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
			
			// Clamp the velocity to prevent excessive speeds
			if (speed > this.ballConfig.maxDragVelocity) {
				const scale = this.ballConfig.maxDragVelocity / speed;
				gameObject.setVelocity(
					currentVelocity.x * scale,
					currentVelocity.y * scale
				);
			}
			
			// Apply additional damping
			gameObject.setVelocity(
				gameObject.body.velocity.x * this.ballConfig.dragDamping,
				gameObject.body.velocity.y * this.ballConfig.dragDamping
			);
			
			// Prevent rotation while dragging
			gameObject.setAngularVelocity(0);
		});
		
		this.scene.input.on('dragend', (pointer, gameObject) => {
			// Ensure we are only ending the drag for a ball.
			if (!gameObject.body || gameObject.body.label !== 'ball' || !gameObject.active) return;
			gameObject.isDragging = false;
			
			// Clean up drag properties
			delete gameObject.dragOffsetX;
			delete gameObject.dragOffsetY;
			
			// Restore the ball's original physics properties.
			if (gameObject.originalFrictionAir !== undefined) {
				gameObject.setFrictionAir(gameObject.originalFrictionAir);
				delete gameObject.originalFrictionAir;
			}
			
			// Stop the ball from moving when released
			gameObject.setVelocity(0, 0);
			gameObject.setAngularVelocity(0);
			
			this.scene.tweens.killTweensOf(gameObject);
			
			const playArea = this.boardView.playAreaPolygon;
			const goalSensors = this.boardView.goalSensors;
			
			const dropX = gameObject.x;
			const dropY = gameObject.y;
			
			let isValidDrop = false;
			let isGoalDrop = false;
			let hitSensor = null;
			
			if (goalSensors && goalSensors.length > 0) {
				const point = {x: dropX, y: dropY};
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
			
			let dropProcessed = false;
			
			if (isGoalDrop) {
				const ball = gameObject;
				
				if (ball && ball.active) {
					if (ball.color === hitSensor.color) {
						dropProcessed = true;
						this.scene.sound.play('drop_valid', {volume: 0.6});
						
						// For the scoring animation, we DO make it static.
						ball.setStatic(true);
						ball.setActive(false);
						ball.setCollisionCategory(0);
						
						const targetInfo = this.scene.bottomScore.getBarAnimationInfo(ball.color);
						
						if (targetInfo) {
							this.scene.game.events.emit('startGoalAnimation', {color: ball.color});
							
							this.scene.tweens.add({
								targets: ball,
								x: targetInfo.x,
								y: targetInfo.y,
								alpha: 0.3,
								duration: 900,
								ease: 'Cubic.easeIn',
								delay: 300,
								onComplete: () => {
									this.scene.game.events.emit('scorePoint', {color: ball.color});
									this.scene.game.events.emit('endGoalAnimation', {color: ball.color});
									this.balls.remove(ball, true, true);
									this.scene.time.delayedCall(this.ballConfig.respawnDelay, this.spawnBall, [], this);
								}
							});
						}
					}
				}
			} else if (isValidDrop) {
				this.scene.sound.play('click_drop', {volume: 0.6});
				dropProcessed = true;
				// Animate the scale back to its normal size.
				gameObject.setStatic(true);
				this.scene.tweens.add({
					targets: gameObject,
					scale: this.ballConfig.finalSize,
					duration: 250,
					ease: 'Sine.easeOut',
					onComplete: () => {
						// After the animation, we can apply organic movement.
						gameObject.setStatic(false);
					}
				});
			}
			
			if (!dropProcessed) {
				// --- Handle invalid drop by returning ball to center ---
				this.scene.sound.play('drop_invalid', {volume: 0.6});
				if (gameObject.active) {
					const center = this.boardView.playArea.center;
					
					// Check if the center point is available
					if (center) {
						gameObject.setStatic(true); // Prevent physics during the tween
						this.scene.tweens.add({
							targets: gameObject,
							x: center.x,
							y: center.y,
							scale: this.ballConfig.finalSize, // Also restore scale
							duration: 500, // A slightly longer duration to show travel
							ease: 'Power2',
							onComplete: () => {
								if (gameObject.active) {
									gameObject.setStatic(false); // Re-enable physics
								}
							}
						});
					} else {
						console.warn('No center point available for returning the ball.');
						// Fallback to the old behavior if center isn't found
						this.fadeAndDestroyBall(gameObject);
					}
				}
			}
		});
	}
	
	update(time, delta) {
		// --- Push balls out of goal areas ---
		const goalSensors = this.boardView.goalSensors;
		const playAreaCenter = this.boardView.playArea.center;
		
		this.balls.getChildren().forEach(ball => {
			// Don't apply any forces to a ball being dragged, static, or inactive.
			if (!ball.body || !ball.active || ball.isStatic() || ball.isDragging) return;
			
			let isInGoal = false;
			// Check if the ball has wandered into a goal area.
			if (goalSensors && goalSensors.length > 0) {
				const bodiesUnderPoint = this.scene.matter.query.point(goalSensors, { x: ball.x, y: ball.y });
				if (bodiesUnderPoint.length > 0) {
					isInGoal = true;
				}
			}
			
			if (isInGoal && playAreaCenter) {
				// The ball is inside a goal sensor. Push it back towards the center of the arena.
				const direction = new Phaser.Math.Vector2(playAreaCenter.x - ball.x, playAreaCenter.y - ball.y);
				direction.normalize();
				
				// A small, constant force to gently nudge the ball.
				// This value could be added to ballConfig for easier tuning.
				const repelForce = 0.001;
				direction.scale(repelForce);
				
				ball.applyForce(direction);
				
			} else {
				// If not in a goal, apply the standard organic movement.
				if (Math.random() > this.ballConfig.organicMoveThreshold) {
					const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
					const force = new Phaser.Math.Vector2(
						Math.cos(angle) * this.ballConfig.organicMoveForce,
						Math.sin(angle) * this.ballConfig.organicMoveForce
					);
					ball.applyForce(force);
				}
			}
		});
	}
	
	createWallsFromPolygon() {
		this.walls.clear(true, true);
		
		const borderSegments = this.boardView.borderSegments;
		const boardImage = this.boardView.boardImage;
		const boardPixelDimension = this.boardView.boardPixelDimension;
		const pixelScale = this.boardView.PIXEL_SCALE;
		
		if (!borderSegments || borderSegments.length === 0 || !boardImage) {
			console.warn('Cannot create walls, border segment data is not ready.');
			return;
		}
		
		const wallThickness = 10;
		const textureCenter = {x: boardPixelDimension / 2, y: boardPixelDimension / 2};
		
		borderSegments.forEach(segment => {
			const p1_world = {
				x: boardImage.x + (segment.p1.x - textureCenter.x) * pixelScale,
				y: boardImage.y + (segment.p1.y - textureCenter.y) * pixelScale
			};
			const p2_world = {
				x: boardImage.x + (segment.p2.x - textureCenter.x) * pixelScale,
				y: boardImage.y + (segment.p2.y - textureCenter.y) * pixelScale
			};
			
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
		});
	}
	
	// --- MODIFICATION START ---
	spawnBall() {
		if (this.balls.countActive(true) >= this.ballConfig.maxBalls || this.ballConfig.colors.length === 0) {
			return;
		}
		
		// Check if the play area and its center point are available from the BoardView.
		if (!this.boardView.playArea || !this.boardView.playArea.center) {
			// If not ready, wait a moment and try to spawn again.
			this.scene.time.delayedCall(50, this.spawnBall, [], this);
			return;
		}
		
		// Always use the center of the arena as the target drop point.
		const targetPoint = this.boardView.playArea.center;
		
		const spawnX = targetPoint.x;
		const spawnY = -50; // Start the ball above the screen.
		const colorIndex = Phaser.Math.Between(0, this.ballConfig.colors.length - 1);
		const textureKey = `ball_${colorIndex}`;
		const ballColor = this.ballConfig.colors[colorIndex];
		
		const ball = this.scene.matter.add.image(spawnX, spawnY, textureKey, null, {
			shape: {type: 'circle', radius: this.ballConfig.pixelSize},
			restitution: this.ballConfig.restitution,
			frictionAir: this.ballConfig.frictionAir,
			label: 'ball'
		});
		this.balls.add(ball);
		ball.color = ballColor;
		ball.isDragging = false; // Custom property to track dragging state.
		
		ball.setScale(this.ballConfig.initialSize);
		ball.setOrigin(0.5, 0.5);
		ball.setStatic(true);
		this.scene.input.setDraggable(ball.setInteractive());
		
		// Animate the ball dropping into the center.
		this.scene.tweens.add({
			targets: ball,
			y: targetPoint.y,
			scale: this.ballConfig.finalSize,
			duration: this.ballConfig.dropDuration,
			ease: 'Bounce.easeOut',
			onStart: () => {
				this.scene.sound.play('drop', {volume: 0.7});
			},
			onComplete: () => {
				if (!ball.active) return;
				
				ball.setStatic(false);
				
				// Give the ball a little nudge in a random direction after it lands.
				const initialSpeed = Phaser.Math.FloatBetween(2, 5);
				const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
				
				const velocityX = Math.cos(angle) * initialSpeed;
				const velocityY = Math.sin(angle) * initialSpeed;
				
				ball.setVelocity(velocityX, velocityY);
				
				ball.lifespanTimer = this.scene.time.delayedCall(this.ballConfig.lifespan, this.fadeAndDestroyBall, [ball], this);
			}
		});
	}
	// --- MODIFICATION END ---
	
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
}

// --- Scene 2: The Main Board View ---
class BoardViewScene extends Phaser.Scene {
	constructor() {
		super({ key: 'BoardViewScene', active: true });
		this.BOARD_PIXEL_WIDTH = 400;
		this.BOARD_PIXEL_HEIGHT = 400;
		this.PIXEL_SCALE = 2;
		this.SELECTOR_SCREEN_HEIGHT = SELECTOR_SCREEN_HEIGHT - 80; // From globals.js
		this.borderPixels = [];
		this.currentSides = 3;
		this.walls = null;
		// This will hold the precise geometry of the play area for other scenes to use.
		this.playAreaPolygon = null;
		this.isMapView = false;
		this.glitchPipeline = null;
		
		// Central Glitch Configuration & State
		this.shaderGlitches = []; // Stores active stretch glitches for the shader
		this.activeBorderGlitches = []; // Stores active border glitches for canvas drawing
		this.whiteColor = Phaser.Display.Color.ValueToColor('#FFFFFF'); // Phaser color object for interpolation
		
		this.glitchConfig = {
			stretch: {
				minSize: 0.4,
				maxSize: 1.0,
				minDuration: 50,
				maxDuration: 500,
				minDelay: 400,
				maxDelay: 2500
			},
			border: {
				minLength: 15,
				maxLength: 150,
				minDuration: 300,
				maxDuration: 1500,
				minDelay: 100,
				maxDelay: 500,
				color: '#555555'
			}
		};
		
		// Updated configuration for the goals, now including a dash pattern.
		this.goalConfig = {
			width: 100, // The width of the goal opening in pixels.
			depth: 30, // How far the net pocket sticks out from the wall.
			chamfer: 8, // The size of the 45-degree corner cut on the net.
			dashLength: 3, // The length of a dash in pixels.
			gapLength: 3 // The length of a gap in pixels.
		};
	}
	
	create() {
		console.log('BoardViewScene: create()');
		this.cameras.main.setViewport(0, this.SELECTOR_SCREEN_HEIGHT, this.scale.width, this.scale.height - this.SELECTOR_SCREEN_HEIGHT);
		
		this.cameras.main.setPostPipeline('Glitch');
		this.glitchPipeline = this.cameras.main.getPostPipeline('Glitch');
		
		this.boardTexture = this.textures.createCanvas('boardTexture', this.BOARD_PIXEL_WIDTH, this.BOARD_PIXEL_HEIGHT);
		this.boardImage = this.add.image(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			'boardTexture'
		).setScale(this.PIXEL_SCALE).setInteractive();
		
		this.walls = this.physics.add.staticGroup();
		
		this.game.events.on('boardConfigurationChanged', (config) => {
			this.currentSides = config.sides;
			this.drawBoardShape();
		}, this);
		
		// Draw the initial board state when the scene is created.
		// This ensures the physics walls exist before other scenes (like BallScene)
		// try to create colliders with them.
		this.drawBoardShape();
		
		this.boardImage.on('pointerdown', this.toggleMapView, this);
		this.scale.on('resize', this.handleResize, this);
		
		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
		
		// --- MODIFICATION START ---
		// Launch the BallScene to run in parallel with this scene.
		// This starts the gameplay logic (like spawning balls). The balls were not
		// "dropping" because the BallScene was loaded but never activated, so its
		// update loop was not running.
		this.scene.launch('BallScene');
		// --- MODIFICATION END ---
	}
	
	update(time, delta) {
		// 1. Update Shader (Stretch) Glitches
		this.shaderGlitches = this.shaderGlitches.filter(glitch => glitch.endTime > time);
		const maxGlitchAmount = this.shaderGlitches.reduce((max, glitch) => {
			return Math.max(max, glitch.size);
		}, 0);
		if (this.glitchPipeline) {
			this.glitchPipeline.setGlitchAmount(maxGlitchAmount);
		}
		
		// 2. Update Canvas (Border) Glitches
		this.updateBorderGlitches(time);
	}
	
	scheduleNextStretchGlitch() {
		const config = this.glitchConfig.stretch;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		this.time.delayedCall(delay, this.triggerNewStretchGlitch, [], this);
	}
	
	triggerNewStretchGlitch() {
		const config = this.glitchConfig.stretch;
		const newGlitch = {
			size: Phaser.Math.FloatBetween(config.minSize, config.maxSize),
			endTime: this.time.now + Phaser.Math.Between(config.minDuration, config.maxDuration)
		};
		this.shaderGlitches.push(newGlitch);
		this.scheduleNextStretchGlitch();
	}
	
	scheduleNextBorderGlitch() {
		const config = this.glitchConfig.border;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		this.time.delayedCall(delay, this.triggerBorderGlitch, [], this);
	}
	
	triggerBorderGlitch() {
		this.scheduleNextBorderGlitch(); // Keep the loop going
		
		if (this.isMapView || this.borderPixels.length === 0) return;
		
		const config = this.glitchConfig.border;
		const glitchLength = Phaser.Math.Between(config.minLength, config.maxLength);
		const startIndex = Phaser.Math.Between(0, this.borderPixels.length - 1);
		
		const glitchedPixels = [];
		for (let i = 0; i < glitchLength; i++) {
			const pixel = this.borderPixels[(startIndex + i) % this.borderPixels.length];
			glitchedPixels.push(pixel);
		}
		
		const newGlitch = {
			pixels: glitchedPixels,
			startTime: this.time.now,
			duration: Phaser.Math.Between(config.minDuration, config.maxDuration),
			color: Phaser.Display.Color.ValueToColor(config.color)
		};
		
		this.activeBorderGlitches.push(newGlitch);
	}
	
	updateBorderGlitches(time) {
		if (this.isMapView) return;
		
		this.activeBorderGlitches = this.activeBorderGlitches.filter(g => time < g.startTime + g.duration);
		
		const ctx = this.boardTexture.getContext();
		
		const centerX = this.BOARD_PIXEL_WIDTH / 2;
		const centerY = this.BOARD_PIXEL_HEIGHT / 2;
		const radius = this.isMapView ? centerX - 5 : centerX - 20;
		this.drawArena(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF', null);
		
		this.activeBorderGlitches.forEach(glitch => {
			const elapsed = time - glitch.startTime;
			const progress = elapsed / glitch.duration;
			const pingPongProgress = 1.0 - Math.abs(progress - 0.5) * 2.0;
			
			const currentColor = Phaser.Display.Color.Interpolate.ColorWithColor(
				this.whiteColor,
				glitch.color,
				100,
				pingPongProgress * 100
			);
			
			ctx.fillStyle = Phaser.Display.Color.RGBToString(currentColor.r, currentColor.g, currentColor.b);
			
			glitch.pixels.forEach(p => {
				ctx.fillRect(p.x, p.y, 1, 1);
			});
		});
		
		this.boardTexture.update();
	}
	
	handleResize(gameSize) {
		if (this.isMapView) {
			this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
		} else {
			this.cameras.main.setViewport(0, this.SELECTOR_SCREEN_HEIGHT, gameSize.width, gameSize.height - this.SELECTOR_SCREEN_HEIGHT);
		}
		this.boardImage.setPosition(this.cameras.main.centerX, this.cameras.main.centerY);
		this.drawBoardShape();
	}
	
	toggleMapView() {
		this.isMapView = !this.isMapView;
		if (this.isMapView) {
			this.activeBorderGlitches = [];
		}
		this.game.events.emit('toggleMapView', this.isMapView);
		this.handleResize({ width: this.scale.width, height: this.scale.height });
		this.drawBoardShape();
	}
	
	drawBoardShape() {
		this.borderPixels = [];
		const ctx = this.boardTexture.getContext();
		ctx.clearRect(0, 0, this.BOARD_PIXEL_WIDTH, this.BOARD_PIXEL_HEIGHT);
		const centerX = this.BOARD_PIXEL_WIDTH / 2;
		const centerY = this.BOARD_PIXEL_HEIGHT / 2;
		const radius = this.isMapView ? this.BOARD_PIXEL_WIDTH / 2 - 5 : this.BOARD_PIXEL_WIDTH / 2 - 20;
		
		// Create a Phaser.Geom.Polygon from the arena's vertices in world space.
		// This is used by BallScene to determine where balls can spawn.
		if (!this.isMapView) {
			const worldVertices = [];
			for (let i = 0; i < this.currentSides; i++) {
				const angle = (i / this.currentSides) * Math.PI * 2 - Math.PI / 2;
				const canvasX = Math.round(centerX + radius * Math.cos(angle));
				const canvasY = Math.round(centerY + radius * Math.sin(angle));
				
				// Convert canvas point to world point using the boardImage's transform.
				const worldX = this.boardImage.x + (canvasX - this.BOARD_PIXEL_WIDTH / 2) * this.PIXEL_SCALE;
				const worldY = this.boardImage.y + (canvasY - this.BOARD_PIXEL_HEIGHT / 2) * this.PIXEL_SCALE;
				worldVertices.push(new Phaser.Geom.Point(worldX, worldY));
			}
			this.playAreaPolygon = new Phaser.Geom.Polygon(worldVertices);
		} else {
			this.playAreaPolygon = null; // No play area in map view.
		}
		
		if (this.walls) {
			this.walls.clear(true, true);
		}
		
		this.drawArena(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF', this.borderPixels);
		
		this.boardTexture.update();
	}
	
	drawArena(ctx, cx, cy, radius, sides, color = '#FFFFFF', pixelStore = null) {
		const { width: goalWidth, depth: goalDepth, chamfer, dashLength, gapLength } = this.goalConfig;
		ctx.fillStyle = color;
		
		const points = [];
		for (let i = 0; i < sides; i++) {
			const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
			points.push({
				x: Math.round(cx + radius * Math.cos(angle)),
				y: Math.round(cy + radius * Math.sin(angle))
			});
		}
		
		for (let i = 0; i < sides; i++) {
			const p1 = points[i];
			const p2 = points[(i + 1) % sides];
			
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			
			let normalX = midX - cx;
			let normalY = midY - cy;
			const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);
			if (normalLen > 0) {
				normalX /= normalLen;
				normalY /= normalLen;
			}
			
			let sideVecX = p2.x - p1.x;
			let sideVecY = p2.y - p1.y;
			const sideVecLen = Math.sqrt(sideVecX * sideVecX + sideVecY * sideVecY);
			if (sideVecLen > 0) {
				sideVecX /= sideVecLen;
				sideVecY /= sideVecLen;
			}
			
			const post1 = {
				x: Math.round(midX - sideVecX * (goalWidth / 2)),
				y: Math.round(midY - sideVecY * (goalWidth / 2))
			};
			const post2 = {
				x: Math.round(midX + sideVecX * (goalWidth / 2)),
				y: Math.round(midY + sideVecY * (goalWidth / 2))
			};
			
			this.drawPixelLine(ctx, p1.x, p1.y, post1.x, post1.y, pixelStore);
			this.drawPixelLine(ctx, post2.x, post2.y, p2.x, p2.y, pixelStore);
			
			if (!this.isMapView && this.walls) {
				this.createWallBody(p1, post1);
				this.createWallBody(p2, post2);
			}
			
			const back1 = {
				x: Math.round(post1.x + normalX * goalDepth + sideVecX * chamfer),
				y: Math.round(post1.y + normalY * goalDepth + sideVecY * chamfer)
			};
			const back2 = {
				x: Math.round(post2.x + normalX * goalDepth - sideVecX * chamfer),
				y: Math.round(post2.y + normalY * goalDepth - sideVecY * chamfer)
			};
			
			this.drawDashedPixelLine(ctx, post1.x, post1.y, back1.x, back1.y, dashLength, gapLength, pixelStore);
			this.drawDashedPixelLine(ctx, back1.x, back1.y, back2.x, back2.y, dashLength, gapLength, pixelStore);
			this.drawDashedPixelLine(ctx, back2.x, back2.y, post2.x, post2.y, dashLength, gapLength, pixelStore);
		}
	}
	
	createWallBody(p1, p2) {
		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;
		const length = Math.sqrt(dx * dx + dy * dy);
		const angle = Math.atan2(dy, dx);
		const centerX = p1.x + dx * 0.5;
		const centerY = p1.y + dy * 0.5;
		
		const worldX = this.boardImage.x + (centerX - this.BOARD_PIXEL_WIDTH / 2) * this.PIXEL_SCALE;
		const worldY = this.boardImage.y + (centerY - this.BOARD_PIXEL_HEIGHT / 2) * this.PIXEL_SCALE;
		
		const wall = this.walls.create(worldX, worldY);
		
		// Use `setDisplaySize` to set the dimensions of the wall's visual and physics body.
		// The `setSize` method is for setting the input hit area, not the physics body size.
		wall.setDisplaySize(length * this.PIXEL_SCALE, 2 * this.PIXEL_SCALE);
		wall.setRotation(angle);
		wall.refreshBody();
	}
	
	drawPixelLine(ctx, x0, y0, x1, y1, pixelStore) {
		const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		while (true) {
			ctx.fillRect(x0, y0, 1, 1);
			if (pixelStore) pixelStore.push({ x: x0, y: y0 });
			if (x0 === x1 && y0 === y1) break;
			let e2 = 2 * err;
			if (e2 >= dy) { err += dy; x0 += sx; }
			if (e2 <= dx) { err += dx; y0 += sy; }
		}
	}
	
	drawDashedPixelLine(ctx, x0, y0, x1, y1, dashLength, gapLength, pixelStore) {
		const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		
		let segmentCounter = 0;
		let isDrawing = true;
		
		while (true) {
			if (isDrawing) {
				ctx.fillRect(x0, y0, 1, 1);
				if (pixelStore) pixelStore.push({ x: x0, y: y0 });
			}
			
			segmentCounter++;
			
			if (isDrawing && segmentCounter >= dashLength) {
				segmentCounter = 0;
				isDrawing = false;
			} else if (!isDrawing && segmentCounter >= gapLength) {
				segmentCounter = 0;
				isDrawing = true;
			}
			
			if (x0 === x1 && y0 === y1) break;
			let e2 = 2 * err;
			if (e2 >= dy) { err += dy; x0 += sx; }
			if (e2 <= dx) { err += dx; y0 += sy; }
		}
	}
}

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
		this.playArea = null;
		this.playAreaPolygon = null;

		this.isMapView = false;
		this.glitchPipeline = null;
		this.debugGraphics = null;
		this.debugDraw = false; // Set to true to enable debug drawing of the playAreaPolygon.
		this.shaderGlitches = [];
		this.activeBorderGlitches = [];
		this.whiteColor = Phaser.Display.Color.ValueToColor('#FFFFFF');
		this.glitchConfig = {
			stretch: { minSize: 0.4, maxSize: 1.0, minDuration: 50, maxDuration: 500, minDelay: 400, maxDelay: 2500 },
			border: { minLength: 15, maxLength: 150, minDuration: 300, maxDuration: 1500, minDelay: 100, maxDelay: 500, color: '#555555' }
		};
		this.goalConfig = { width: 100, depth: 30, chamfer: 8, dashLength: 3, gapLength: 3 };
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
		this.debugGraphics = this.add.graphics();
		
		this.game.events.on('boardConfigurationChanged', (config) => {
			this.currentSides = config.sides;
			this.drawBoardShape();
		}, this);
		
		this.boardImage.on('pointerdown', this.toggleMapView, this);
		this.scale.on('resize', this.handleResize, this);
		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
		this.scene.launch('BallScene');
	}
	
	update(time, delta) {
		this.shaderGlitches = this.shaderGlitches.filter(glitch => glitch.endTime > time);
		const maxGlitchAmount = this.shaderGlitches.reduce((max, glitch) => Math.max(max, glitch.size), 0);
		if (this.glitchPipeline) { this.glitchPipeline.setGlitchAmount(maxGlitchAmount); }
		this.updateBorderGlitches(time);
		this.drawDebug();
	}
	
	drawDebug() {
		this.debugGraphics.clear();
		if (this.debugDraw && this.playAreaPolygon) {
			this.debugGraphics.lineStyle(2, 0xff0000, 0.7);
			this.debugGraphics.strokePoints(this.playAreaPolygon.points, true);
		}
	}
	
	toggleMapView() {
		this.isMapView = !this.isMapView;
		if (this.isMapView) {
			this.activeBorderGlitches = [];
			this.playAreaPolygon = null;
			this.playArea = null;
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

		if (!this.isMapView) {
			const worldVertices = [];
			const localVertices = [];
			const worldCenter = { x: this.boardImage.x, y: this.boardImage.y };
			
			for (let i = 0; i < this.currentSides; i++) {
				const angle = (i / this.currentSides) * Math.PI * 2 - Math.PI / 2;
				const canvasX = Math.round(centerX + radius * Math.cos(angle));
				const canvasY = Math.round(centerY + radius * Math.sin(angle));
				
				// 1. Calculate LOCAL vertices (relative to the board's center, scaled)
				//    This is what Matter.js needs.
				const localX = (canvasX - centerX) * this.PIXEL_SCALE;
				const localY = (canvasY - centerY) * this.PIXEL_SCALE;
				localVertices.push({ x: localX, y: localY });
				
				// 2. Calculate WORLD vertices by adding the local offset to the world center.
				//    This is what getRandomPointInPolygon needs.
				const worldX = worldCenter.x + localX;
				const worldY = worldCenter.y + localY;
				worldVertices.push(new Phaser.Geom.Point(worldX, worldY));
			}
			// Store the local vertices and world center for the physics body
			this.playArea = { center: worldCenter, vertices: localVertices };
			// Store the world-space polygon for ball spawning
			this.playAreaPolygon = new Phaser.Geom.Polygon(worldVertices);
		}
		
		this.drawArena(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF', this.borderPixels);
		this.boardTexture.update();
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

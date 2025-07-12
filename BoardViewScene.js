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
		
		// --- MODIFICATION START ---
		// New configuration for the goal posts.
		this.goalConfig = {
			width: 40, // The width of the goal opening in pixels.
			depth: 15, // How far the net pocket sticks out from the wall.
			postRadius: 3 // The radius of the circular goal posts.
		};
		// --- MODIFICATION END ---
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
		
		this.game.events.on('sidesChanged', (sides) => {
			this.currentSides = sides;
			this.drawBoardShape();
		}, this);
		
		this.boardImage.on('pointerdown', this.toggleMapView, this);
		this.scale.on('resize', this.handleResize, this);
		
		this.drawBoardShape();
		
		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
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
		
		// --- MODIFICATION START ---
		// The polygon and goals must be redrawn each frame so the glitches can be drawn over them.
		const centerX = this.BOARD_PIXEL_WIDTH / 2;
		const centerY = this.BOARD_PIXEL_HEIGHT / 2;
		const radius = this.isMapView ? centerX - 5 : centerX - 20;
		
		// Draw the base polygon shape and get its vertices.
		const points = this.drawPixelPolygon(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF');
		// Draw the goals on each side.
		this.drawGoals(ctx, points, centerX, centerY);
		// --- MODIFICATION END ---
		
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
		let radius = this.isMapView ? this.BOARD_PIXEL_WIDTH / 2 - 5 : this.BOARD_PIXEL_WIDTH / 2 - 20;
		
		// --- MODIFICATION START ---
		// Draw the main polygon and get its vertices, populating the border pixel array for glitches.
		const points = this.drawPixelPolygon(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF', this.borderPixels);
		// Draw the goals on each side of the polygon.
		this.drawGoals(ctx, points, centerX, centerY);
		// --- MODIFICATION END ---
		
		this.boardTexture.update();
	}
	
	drawPixelPolygon(ctx, cx, cy, radius, sides, color = '#FFFFFF', pixelStore = null) {
		const points = [];
		for (let i = 0; i < sides; i++) {
			const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
			points.push({ x: Math.round(cx + radius * Math.cos(angle)), y: Math.round(cy + radius * Math.sin(angle)) });
		}
		ctx.fillStyle = color;
		for (let i = 0; i < sides; i++) {
			const p1 = points[i];
			const p2 = points[(i + 1) % sides];
			this.drawPixelLine(ctx, p1.x, p1.y, p2.x, p2.y, pixelStore);
		}
		// --- MODIFICATION START ---
		// Return the vertices so they can be used by the goal drawing function.
		return points;
		// --- MODIFICATION END ---
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
	
	// --- NEW METHOD START ---
	/**
	 * Draws a filled circle pixel by pixel.
	 * @param {CanvasRenderingContext2D} ctx - The canvas context.
	 * @param {number} cx - The center x-coordinate of the circle.
	 * @param {number} cy - The center y-coordinate of the circle.
	 * @param {number} radius - The radius of the circle.
	 * @param {string} color - The fill color of the circle.
	 */
	drawPixelCircle(ctx, cx, cy, radius, color) {
		ctx.fillStyle = color;
		// Iterate over the bounding box of the circle
		for (let y = -radius; y <= radius; y++) {
			for (let x = -radius; x <= radius; x++) {
				// If the point (x, y) is inside the circle, draw a pixel
				if (x * x + y * y <= radius * radius) {
					ctx.fillRect(cx + x, cy + y, 1, 1);
				}
			}
		}
	}
	
	/**
	 * Draws a goal on each side of a polygon.
	 * @param {CanvasRenderingContext2D} ctx - The canvas context.
	 * @param {Array<object>} points - The array of vertices for the polygon.
	 * @param {number} cx - The center x-coordinate of the polygon.
	 * @param {number} cy - The center y-coordinate of the polygon.
	 */
	drawGoals(ctx, points, cx, cy) {
		const color = '#FFFFFF'; // Goals are the same color as the border
		const { width: goalWidth, depth: goalDepth, postRadius } = this.goalConfig;
		const sides = points.length;
		
		for (let i = 0; i < sides; i++) {
			const p1 = points[i];
			const p2 = points[(i + 1) % sides];
			
			// Calculate the midpoint of the current side.
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			
			// Get the vector from the polygon's center to the side's midpoint.
			// This gives us the outward-facing normal direction for the goal.
			let normalX = midX - cx;
			let normalY = midY - cy;
			const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);
			if (normalLen === 0) continue; // Should not happen in a valid polygon
			
			// Normalize the normal vector.
			normalX /= normalLen;
			normalY /= normalLen;
			
			// Get the vector that runs along the side.
			let sideVecX = p2.x - p1.x;
			let sideVecY = p2.y - p1.y;
			const sideVecLen = Math.sqrt(sideVecX * sideVecX + sideVecY * sideVecY);
			if (sideVecLen === 0) continue;
			
			// Normalize the side vector.
			sideVecX /= sideVecLen;
			sideVecY /= sideVecLen;
			
			// Calculate the positions for the two goal posts by moving from the
			// midpoint along the side's vector.
			const post1X = Math.round(midX - sideVecX * (goalWidth / 2));
			const post1Y = Math.round(midY - sideVecY * (goalWidth / 2));
			const post2X = Math.round(midX + sideVecX * (goalWidth / 2));
			const post2Y = Math.round(midY + sideVecY * (goalWidth / 2));
			
			// Calculate the back of the net by moving from the midpoint along the outward normal.
			const netBackX = Math.round(midX + normalX * goalDepth);
			const netBackY = Math.round(midY + normalY * goalDepth);
			
			// Draw the two circular posts.
			this.drawPixelCircle(ctx, post1X, post1Y, postRadius, color);
			this.drawPixelCircle(ctx, post2X, post2Y, postRadius, color);
			
			// Draw the net pocket by connecting the posts to the back point.
			// We pass `null` for pixelStore so these lines aren't added to the glitchable border.
			this.drawPixelLine(ctx, post1X, post1Y, netBackX, netBackY, null);
			this.drawPixelLine(ctx, post2X, post2Y, netBackX, netBackY, null);
		}
	}
	// --- NEW METHOD END ---
}
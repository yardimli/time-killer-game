// --- Scene 2: The Main Board View ---
class BoardViewScene extends Phaser.Scene {
	constructor() {
		super({key: 'BoardViewScene', active: true});
		
		const config = GAME_CONFIG.BoardViewScene;
		const sharedConfig = GAME_CONFIG.Shared;
		
		this.BOARD_PIXEL_WIDTH = config.BOARD_PIXEL_WIDTH;
		this.BOARD_PIXEL_HEIGHT = config.BOARD_PIXEL_HEIGHT;
		this.PIXEL_SCALE = sharedConfig.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
		this.SCORE_SCREEN_HEIGHT = sharedConfig.SCORE_SCREEN_HEIGHT;
		this.backgroundColor = config.backgroundColor;
		this.debugDraw = config.debugDraw;
		this.glitchConfig = config.glitchConfig;
		this.goalConfig = config.goalConfig;
		
		this.borderPixels = [];
		this.currentSides = 3;
		this.goals = [];
		this.goalSensors = [];
		this.playArea = null;
		this.playAreaPolygon = null;
		
		this.glitchPipeline = null;
		this.debugGraphics = null;
		this.shaderGlitches = [];
		this.activeBorderGlitches = [];
		this.whiteColor = Phaser.Display.Color.ValueToColor('#FFFFFF');
		
		// Properties to hold references to the glitch timers.
		this.stretchGlitchTimer = null;
		this.borderGlitchTimer = null;
	}
	
	create() {
		console.log('BoardViewScene: create()');
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH,
			0,
			this.scale.width - this.SELECTOR_SCREEN_WIDTH,
			this.scale.height - this.SCORE_SCREEN_HEIGHT
		);
		
		this.cameras.main.setBackgroundColor(this.backgroundColor);
		
		this.cameras.main.setPostPipeline('Glitch');
		this.glitchPipeline = this.cameras.main.getPostPipeline('Glitch');
		this.boardTexture = this.textures.createCanvas('boardTexture', this.BOARD_PIXEL_WIDTH, this.BOARD_PIXEL_HEIGHT);
		this.boardImage = this.add.image(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			'boardTexture'
		).setScale(this.PIXEL_SCALE).setInteractive();
		this.debugGraphics = this.add.graphics();
		
		// The event listener now calls a dedicated handler function for better organization.
		this.game.events.on('boardConfigurationChanged', this.handleBoardConfigurationChanged, this);
		
		this.scale.on('resize', this.handleResize, this);
		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
		this.scene.launch('BallScene');
	}
	
	/**
	 * Handles changes to the board configuration.
	 * This function clears all active and pending glitches before redrawing the board.
	 * @param {object} config - The new board configuration object.
	 */
	handleBoardConfigurationChanged(config) {
		// 1. Clear all active glitch data arrays.
		this.shaderGlitches = [];
		this.activeBorderGlitches = [];
		
		// 2. Cancel any scheduled timers that would create new glitches.
		if (this.stretchGlitchTimer) {
			this.stretchGlitchTimer.remove();
			this.stretchGlitchTimer = null;
		}
		if (this.borderGlitchTimer) {
			this.borderGlitchTimer.remove();
			this.borderGlitchTimer = null;
		}
		
		// 3. Update the board properties.
		this.currentSides = config.sides;
		this.goals = config.goals;
		
		// 4. Redraw the board with the new configuration.
		this.drawBoardShape();
		
		// 5. Reschedule the glitch effects for the new board.
		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
	}
	
	update(time, delta) {
		this.shaderGlitches = this.shaderGlitches.filter(glitch => glitch.endTime > time);
		const maxGlitchAmount = this.shaderGlitches.reduce((max, glitch) => Math.max(max, glitch.size), 0);
		if (this.glitchPipeline) {
			this.glitchPipeline.setGlitchAmount(maxGlitchAmount);
		}
		this.updateBorderGlitches(time);
		this.drawDebug();
	}
	
	drawDebug() {
		this.debugGraphics.clear();
		if (this.debugDraw && this.playAreaPolygon) {
			this.debugGraphics.lineStyle(2, 0x00ff00, 0.7);
			this.goalSensors.forEach(sensor => {
				this.debugGraphics.strokePoints(sensor.vertices, true);
			});
			
			this.debugGraphics.lineStyle(2, 0xff0000, 0.7);
			this.debugGraphics.strokePoints(this.playAreaPolygon.points, true);
			
			
		}
	}
	
	
	drawBoardShape() {
		this.goalSensors.forEach(sensor => this.matter.world.remove(sensor));
		this.goalSensors = [];
		
		this.borderPixels = [];
		const ctx = this.boardTexture.getContext();
		ctx.clearRect(0, 0, this.BOARD_PIXEL_WIDTH, this.BOARD_PIXEL_HEIGHT);
		const centerX = this.BOARD_PIXEL_WIDTH / 2;
		const centerY = this.BOARD_PIXEL_HEIGHT / 2;
		const padding = 1; // A small buffer to prevent drawing on the very edge of the canvas.
		const radius = (this.BOARD_PIXEL_WIDTH / 2) - this.goalConfig.depth - padding;
		
		const worldVertices = [];
		const localVertices = [];
		const worldCenter = {x: this.boardImage.x, y: this.boardImage.y};
		
		for (let i = 0; i < this.currentSides; i++) {
			const angle = (i / this.currentSides) * Math.PI * 2 - Math.PI / 2;
			const canvasX = Math.round(centerX + radius * Math.cos(angle));
			const canvasY = Math.round(centerY + radius * Math.sin(angle));
			
			const localX = (canvasX - centerX) * this.PIXEL_SCALE;
			const localY = (canvasY - centerY) * this.PIXEL_SCALE;
			localVertices.push({x: localX, y: localY});
			
			const worldX = worldCenter.x + localX;
			const worldY = worldCenter.y + localY;
			worldVertices.push(new Phaser.Geom.Point(worldX, worldY));
		}
		this.playArea = {center: worldCenter, vertices: localVertices};
		this.playAreaPolygon = new Phaser.Geom.Polygon(worldVertices);
		this.createGoalSensors(centerX, centerY, radius, worldCenter);
		
		this.drawArena(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF', this.borderPixels);
		this.boardTexture.update();
	}
	
	scheduleNextStretchGlitch() {
		const config = this.glitchConfig.stretch;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		// Store a reference to the timer so it can be cancelled.
		this.stretchGlitchTimer = this.time.delayedCall(delay, this.triggerNewStretchGlitch, [], this);
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
		// Store a reference to the timer so it can be cancelled.
		this.borderGlitchTimer = this.time.delayedCall(delay, this.triggerBorderGlitch, [], this);
	}
	
	triggerBorderGlitch() {
		this.scheduleNextBorderGlitch();
		
		if (this.borderPixels.length === 0) return;
		
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
		this.activeBorderGlitches = this.activeBorderGlitches.filter(g => time < g.startTime + g.duration);
		
		const ctx = this.boardTexture.getContext();
		
		const centerX = this.BOARD_PIXEL_WIDTH / 2;
		const centerY = this.BOARD_PIXEL_HEIGHT / 2;
		const padding = 1;
		const radius = centerX - this.goalConfig.depth - padding;
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
		this.cameras.main.setViewport(
			this.SELECTOR_SCREEN_WIDTH,
			0,
			gameSize.width - this.SELECTOR_SCREEN_WIDTH,
			gameSize.height - this.SCORE_SCREEN_HEIGHT
		);
		this.boardImage.setPosition(this.cameras.main.centerX, this.cameras.main.centerY);
		this.drawBoardShape();
	}
	
	drawArena(ctx, cx, cy, radius, sides, color = '#FFFFFF', pixelStore = null) {
		const {width: goalWidth, depth: goalDepth, chamfer, dashLength, gapLength} = this.goalConfig;
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
			const goalInfo = this.goals.find(g => g.side === i);
			const goalColor = goalInfo ? goalInfo.color : color;
			
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
			
			ctx.fillStyle = color;
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
			
			ctx.fillStyle = goalColor;
			this.drawDashedPixelLine(ctx, post1.x, post1.y, back1.x, back1.y, dashLength, gapLength, pixelStore);
			this.drawDashedPixelLine(ctx, back1.x, back1.y, back2.x, back2.y, dashLength, gapLength, pixelStore);
			this.drawDashedPixelLine(ctx, back2.x, back2.y, post2.x, post2.y, dashLength, gapLength, pixelStore);
		}
	}
	
	createGoalSensors(cx, cy, radius, worldCenter) {
		const {width: goalWidth, depth: goalDepth} = this.goalConfig;
		
		const points = [];
		for (let i = 0; i < this.currentSides; i++) {
			const angle = (i / this.currentSides) * Math.PI * 2 - Math.PI / 2;
			points.push({
				x: Math.round(cx + radius * Math.cos(angle)),
				y: Math.round(cy + radius * Math.sin(angle))
			});
		}
		
		for (let i = 0; i < this.currentSides; i++) {
			const goalInfo = this.goals.find(g => g.side === i);
			if (!goalInfo) continue;
			
			const p1 = points[i];
			const p2 = points[(i + 1) % this.currentSides];
			
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			
			let normalX = midX - cx;
			let normalY = midY - cy;
			const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);
			if (normalLen > 0) {
				normalX /= normalLen;
				normalY /= normalLen;
			}
			
			const goalCenterX_canvas = midX + normalX * (goalDepth / 2);
			const goalCenterY_canvas = midY + normalY * (goalDepth / 2);
			
			const goalCenterX_world = worldCenter.x + (goalCenterX_canvas - cx) * this.PIXEL_SCALE;
			const goalCenterY_world = worldCenter.y + (goalCenterY_canvas - cy) * this.PIXEL_SCALE;
			
			const sideAngle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
			
			const sensor = this.matter.add.rectangle(
				goalCenterX_world,
				goalCenterY_world,
				goalWidth * this.PIXEL_SCALE,
				goalDepth * this.PIXEL_SCALE,
				{
					isSensor: true,
					isStatic: true,
					label: 'goal',
					angle: sideAngle
				}
			);
			
			sensor.color = goalInfo.color;
			
			this.goalSensors.push(sensor);
		}
	}
	
	drawPixelLine(ctx, x0, y0, x1, y1, pixelStore) {
		const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		while (true) {
			ctx.fillRect(x0, y0, 1, 1);
			if (pixelStore) pixelStore.push({x: x0, y: y0});
			if (x0 === x1 && y0 === y1) break;
			let e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
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
				if (pixelStore) pixelStore.push({x: x0, y: y0});
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
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
		}
	}
}

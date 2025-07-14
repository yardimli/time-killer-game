class BoardView {
	constructor(scene) {
		this.scene = scene; // Store a reference to the main scene.
		
		const config = GAME_CONFIG.BoardViewScene;
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;
		
		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.BOTTOM_SCORE_SCREEN_HEIGHT = scoreScenesConfig.BOTTOM_SCORE_SCREEN_HEIGHT;
		
		this.boardPixelDimension = 0;
		
		this.PIXEL_SCALE = sharedConfig.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
		this.backgroundColor = config.backgroundColor;
		this.debugDraw = config.debugDraw;
		this.glitchConfig = config.glitchConfig;
		this.goalConfig = config.goalConfig;
		
		this.borderSegments = [];
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
		
		this.stretchGlitchTimer = null;
		this.borderGlitchTimer = null;
	}
	
	init() {
		console.log('BoardView: init()');
		
		this.calculateBoardPixelDimension();
		
		this.glitchPipeline = this.scene.cameras.main.getPostPipeline('Glitch');
		
		this.boardTexture = this.scene.textures.createCanvas('boardTexture', this.boardPixelDimension, this.boardPixelDimension);
		
		// The board image will be positioned by the handleResize method.
		this.boardImage = this.scene.add.image(0, 0, 'boardTexture')
			.setScale(this.PIXEL_SCALE)
			.setInteractive();
		
		this.debugGraphics = this.scene.add.graphics();
		
		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardConfigurationChanged, this);
		
		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
	}
	
	handleBoardConfigurationChanged(config) {
		this.shaderGlitches = [];
		this.activeBorderGlitches = [];
		
		if (this.stretchGlitchTimer) {
			this.stretchGlitchTimer.remove();
			this.stretchGlitchTimer = null;
		}
		if (this.borderGlitchTimer) {
			this.borderGlitchTimer.remove();
			this.borderGlitchTimer = null;
		}
		
		this.currentSides = config.sides;
		this.goals = config.goals;
		
		this.drawBoardShape();
		
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
		this.goalSensors.forEach(sensor => this.scene.matter.world.remove(sensor));
		this.goalSensors = [];
		
		this.borderSegments = [];
		const ctx = this.boardTexture.getContext();
		ctx.clearRect(0, 0, this.boardPixelDimension, this.boardPixelDimension);
		const centerX = this.boardPixelDimension / 2;
		const centerY = this.boardPixelDimension / 2;
		const padding = 10;
		
		const apothem = (this.boardPixelDimension / 2) - this.goalConfig.depth - padding;
		const calculatedRadius = apothem / Math.cos(Math.PI / this.currentSides);
		
		const maxFitRadius = (this.boardPixelDimension / 2) - padding;
		
		const radius = Math.min(calculatedRadius, maxFitRadius);
		
		const worldVertices = [];
		const localVertices = [];
		const worldCenter = { x: this.boardImage.x, y: this.boardImage.y };
		
		for (let i = 0; i < this.currentSides; i++) {
			const angle = (i / this.currentSides) * Math.PI * 2 - Math.PI / 2;
			const canvasX = Math.round(centerX + radius * Math.cos(angle));
			const canvasY = Math.round(centerY + radius * Math.sin(angle));
			
			const localX = (canvasX - centerX) * this.PIXEL_SCALE;
			const localY = (canvasY - centerY) * this.PIXEL_SCALE;
			localVertices.push({ x: localX, y: localY });
			
			const worldX = worldCenter.x + localX;
			const worldY = worldCenter.y + localY;
			worldVertices.push(new Phaser.Geom.Point(worldX, worldY));
		}
		this.playArea = { center: worldCenter, vertices: localVertices };
		this.playAreaPolygon = new Phaser.Geom.Polygon(worldVertices);
		this.createGoalSensors(centerX, centerY, radius, worldCenter);
		
		this.drawArena(ctx, centerX, centerY, radius, this.currentSides, '#FFFFFF', this.borderSegments);
		this.boardTexture.update();
	}
	
	scheduleNextStretchGlitch() {
		const config = this.glitchConfig.stretch;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		this.stretchGlitchTimer = this.scene.time.delayedCall(delay, this.triggerNewStretchGlitch, [], this);
	}
	
	triggerNewStretchGlitch() {
		const config = this.glitchConfig.stretch;
		const newGlitch = {
			size: Phaser.Math.FloatBetween(config.minSize, config.maxSize),
			endTime: this.scene.time.now + Phaser.Math.Between(config.minDuration, config.maxDuration)
		};
		this.shaderGlitches.push(newGlitch);
		this.scheduleNextStretchGlitch();
	}
	
	scheduleNextBorderGlitch() {
		const config = this.glitchConfig.border;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		this.borderGlitchTimer = this.scene.time.delayedCall(delay, this.triggerBorderGlitch, [], this);
	}
	
	triggerBorderGlitch() {
		this.scheduleNextBorderGlitch();
		
		if (this.borderSegments.length === 0) return;
		
		const config = this.glitchConfig.border;
		const glitchLength = Phaser.Math.Between(config.minSegmentLength, config.maxSegmentLength);
		const startIndex = Phaser.Math.Between(0, this.borderSegments.length - 1);
		
		const glitchedSegments = [];
		for (let i = 0; i < glitchLength; i++) {
			const segment = this.borderSegments[(startIndex + i) % this.borderSegments.length];
			glitchedSegments.push(segment);
		}
		
		const newGlitch = {
			segments: glitchedSegments,
			startTime: this.scene.time.now,
			duration: Phaser.Math.Between(config.minDuration, config.maxDuration),
			color: Phaser.Display.Color.ValueToColor(config.color)
		};
		
		this.activeBorderGlitches.push(newGlitch);
	}
	
	updateBorderGlitches(time) {
		this.activeBorderGlitches = this.activeBorderGlitches.filter(g => time < g.startTime + g.duration);
		
		const ctx = this.boardTexture.getContext();
		
		// --- MODIFICATION START ---
		// The previous implementation redrew the entire arena every frame, then drew the glitch
		// effect over it. This overdraw caused visual artifacts like the disappearing dashes.
		// The new implementation clears the canvas and draws each segment (glitched or not) exactly once.
		ctx.clearRect(0, 0, this.boardPixelDimension, this.boardPixelDimension);
		
		// Create a set of all segments that are currently part of an active glitch.
		// A Set provides fast O(1) average time complexity for lookups.
		const allGlitchedSegments = new Set();
		this.activeBorderGlitches.forEach(glitch => {
			glitch.segments.forEach(segment => allGlitchedSegments.add(segment));
		});
		
		// Filter the master list of border segments into those that are not glitched.
		const nonGlitchedSegments = this.borderSegments.filter(s => !allGlitchedSegments.has(s));
		const { dashLength, gapLength } = this.goalConfig;
		
		// --- Draw non-glitched segments ---
		// These form the static, white part of the board.
		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 1;
		
		// Batch draw all non-glitched wall segments (solid lines).
		const nonGlitchedWalls = nonGlitchedSegments.filter(s => !s.isGoal);
		if (nonGlitchedWalls.length > 0) {
			ctx.setLineDash([]);
			ctx.beginPath();
			nonGlitchedWalls.forEach(segment => {
				ctx.moveTo(segment.p1.x, segment.p1.y);
				ctx.lineTo(segment.p2.x, segment.p2.y);
			});
			ctx.stroke();
		}
		
		// Batch draw all non-glitched goal segments (dashed lines).
		const nonGlitchedGoals = nonGlitchedSegments.filter(s => s.isGoal);
		if (nonGlitchedGoals.length > 0) {
			ctx.setLineDash([dashLength, gapLength]);
			ctx.beginPath();
			nonGlitchedGoals.forEach(segment => {
				ctx.moveTo(segment.p1.x, segment.p1.y);
				ctx.lineTo(segment.p2.x, segment.p2.y);
			});
			ctx.stroke();
		}
		
		// --- Draw glitched segments ---
		// This logic remains the same, but now it draws onto a clean background, preventing overdraw.
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
			
			ctx.strokeStyle = Phaser.Display.Color.RGBToString(currentColor.r, currentColor.g, currentColor.b);
			ctx.lineWidth = 1;
			
			const goalSegments = glitch.segments.filter(s => s.isGoal);
			const wallSegments = glitch.segments.filter(s => !s.isGoal);
			
			if (wallSegments.length > 0) {
				ctx.setLineDash([]);
				ctx.beginPath();
				wallSegments.forEach(segment => {
					ctx.moveTo(segment.p1.x, segment.p1.y);
					ctx.lineTo(segment.p2.x, segment.p2.y);
				});
				ctx.stroke();
			}
			
			if (goalSegments.length > 0) {
				ctx.setLineDash([dashLength, gapLength]);
				ctx.beginPath();
				goalSegments.forEach(segment => {
					ctx.moveTo(segment.p1.x, segment.p1.y);
					ctx.lineTo(segment.p2.x, segment.p2.y);
				});
				ctx.stroke();
			}
		});
		// --- MODIFICATION END ---
		
		ctx.setLineDash([]);
		
		this.boardTexture.update();
	}
	
	handleResize(gameSize) {
		this.calculateBoardPixelDimension();
		
		const viewX = this.SELECTOR_SCREEN_WIDTH;
		const viewY = this.TOP_SCORE_SCREEN_HEIGHT;
		const viewWidth = gameSize.width - this.SELECTOR_SCREEN_WIDTH;
		const viewHeight = gameSize.height - this.TOP_SCORE_SCREEN_HEIGHT - this.BOTTOM_SCORE_SCREEN_HEIGHT;
		this.boardImage.setPosition(viewX + viewWidth / 2, viewY + viewHeight / 2);
		
		if (this.boardTexture) {
			this.boardTexture.setSize(this.boardPixelDimension, this.boardPixelDimension);
		}
		
		this.drawBoardShape();
	}
	
	calculateBoardPixelDimension() {
		const viewportWidth = this.scene.scale.width - this.SELECTOR_SCREEN_WIDTH;
		const viewportHeight = this.scene.scale.height - this.TOP_SCORE_SCREEN_HEIGHT - this.BOTTOM_SCORE_SCREEN_HEIGHT;
		
		const maxDisplaySize = Math.min(viewportWidth, viewportHeight);
		
		this.boardPixelDimension = Math.floor(maxDisplaySize / this.PIXEL_SCALE);
	}
	
	drawArena(ctx, cx, cy, radius, sides, color = '#FFFFFF', segmentStore = null) {
		const {width: goalWidth, depth: goalDepth, chamfer, dashLength, gapLength} = this.goalConfig;
		
		ctx.lineWidth = 1;
		ctx.lineCap = 'round';
		
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
			const goalColor = color;
			
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
			
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.setLineDash([]);
			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(post1.x, post1.y);
			ctx.moveTo(post2.x, post2.y);
			ctx.lineTo(p2.x, p2.y);
			ctx.stroke();
			
			if (segmentStore) {
				segmentStore.push({ p1: p1, p2: post1, isGoal: false });
				segmentStore.push({ p1: post2, p2: p2, isGoal: false });
			}
			
			const back1 = {
				x: Math.round(post1.x + normalX * goalDepth + sideVecX * chamfer),
				y: Math.round(post1.y + normalY * goalDepth + sideVecY * chamfer)
			};
			const back2 = {
				x: Math.round(post2.x + normalX * goalDepth - sideVecX * chamfer),
				y: Math.round(post2.y + normalY * goalDepth - sideVecY * chamfer)
			};
			
			ctx.strokeStyle = goalColor;
			ctx.setLineDash([dashLength, gapLength]);
			ctx.beginPath();
			ctx.moveTo(post1.x, post1.y);
			ctx.lineTo(back1.x, back1.y);
			ctx.lineTo(back2.x, back2.y);
			ctx.lineTo(post2.x, post2.y);
			ctx.stroke();
			
			if (segmentStore) {
				segmentStore.push({ p1: post1, p2: back1, isGoal: true });
				segmentStore.push({ p1: back1, p2: back2, isGoal: true });
				segmentStore.push({ p1: back2, p2: post2, isGoal: true });
			}
		}
		
		ctx.setLineDash([]);
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
			
			const sensor = this.scene.matter.add.rectangle(
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
}

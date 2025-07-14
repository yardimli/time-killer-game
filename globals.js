// --- Custom GLSL Shader ---
const fragmentShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uGlitchAmount;
varying vec2 outTexCoord;

float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
void main() {
    vec2 uv = outTexCoord;
    float scanline = sin(uv.y * 800.0 + uTime * 0.1) * 0.02;
    float glitch = random(vec2(uTime, uv.y)) * uGlitchAmount;
    if (glitch > 0.95) { uv.x += (random(vec2(uTime * 2.0, uv.y)) - 0.5) * 0.2; }
    vec4 color = texture2D(uMainSampler, uv);
    color.rgb -= scanline;
    color.rgb -= (random(uv + uTime) - 0.5) * 0.05;
    gl_FragColor = color;
}
`;

// --- MODIFICATION: Updated shader to add color inversion and a stronger scanline effect ---
const scanlineFragmentShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uScanlineStrength;
uniform float uScanlineFrequency;

varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;
    
    // Get the original color from the texture for the current pixel.
    vec4 color = texture2D(uMainSampler, uv);
    
    // Calculate the scanline effect. Using abs(sin(...)) creates more distinct dark lines.
    float scanlineEffect = abs(sin(uv.y * uScanlineFrequency)) * uScanlineStrength;
    
    // Apply the scanline by subtracting the effect from the color, making it darker.
    color.rgb -= scanlineEffect;
    
    // Invert the color by subtracting each channel from 1.0.
    color.rgb = vec3(1.0) - color.rgb;
    
    // Set the final pixel color, ensuring alpha remains 1.0.
    gl_FragColor = vec4(color.rgb, 1.0);
}
`;

// --- Custom Post-Processing Pipeline ---
class GlitchPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
	constructor(game) {
		super({ game: game, fragmentShader: fragmentShader, uniforms: ['uMainSampler', 'uTime', 'uGlitchAmount'] });
		this._glitchAmount = 0;
	}
	onPreRender() { this.set1f('uTime', this.game.loop.time * 0.001); this.set1f('uGlitchAmount', this._glitchAmount); }
	setGlitchAmount(amount) { this._glitchAmount = amount; }
}

// --- MODIFICATION: New pipeline class for the scanline effect ---
class ScanlinePostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
	constructor(game) {
		super({
			game: game,
			renderTarget: true, // MODIFICATION: Set renderTarget to true as per the recommended pipeline setup.
			fragmentShader: scanlineFragmentShader,
			uniforms: [
				'uMainSampler',
				'uScanlineStrength',
				'uScanlineFrequency'
			]
		});
		
		// Increased strength for a more visible effect.
		this.scanlineStrength = 0.1;
		this.scanlineFrequency = 800.0;
	}
	
	onPreRender() {
		this.set1f('uScanlineStrength', this.scanlineStrength);
		this.set1f('uScanlineFrequency', this.scanlineFrequency);
	}
}

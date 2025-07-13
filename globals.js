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

// --- Custom Post-Processing Pipeline ---
class GlitchPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
	constructor(game) {
		super({ game: game, fragmentShader: fragmentShader, uniforms: ['uMainSampler', 'uTime', 'uGlitchAmount'] });
		this._glitchAmount = 0;
	}
	onPreRender() { this.set1f('uTime', this.game.loop.time * 0.001); this.set1f('uGlitchAmount', this._glitchAmount); }
	setGlitchAmount(amount) { this._glitchAmount = amount; }
}

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

const crtShader = `

// added for Phaser

#ifdef GL_ES
precision mediump float;
#endif

uniform float time;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

varying vec2 fragCoord;

// replaced all instances of 'iResolution' with 'resolution' in shader below

// --- [ original shader ] ---
// source: https://www.shadertoy.com/view/WsVSzV

float warp = 0.75; // simulate curvature of CRT monitor
float scan = 0.75; // simulate darkness between scanlines

void mainImage(out vec4 fragColor,in vec2 fragCoord)
{
  // squared distance from center
  vec2 uv = fragCoord/resolution.xy;
  vec2 dc = abs(0.5-uv);
  dc *= dc;
  
  // warp the fragment coordinates
  uv.x -= 0.5;
  uv.x *= 1.0+(dc.y*(0.3*warp));
  uv.x += 0.5;

  uv.y -= 0.5;
  uv.y *= 1.0+(dc.x*(0.4*warp));
  uv.y *= -1.0; // have to do this ensure the end result is not flipped upside down
  uv.y += 0.5;

  // sample inside boundaries, otherwise set to black
  if (uv.y > 1.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0) {
      fragColor = vec4(0.0,0.0,0.0,1.0);
  } else {
    // determine if we are drawing in a scanline
    float apply = abs(sin(fragCoord.y)*0.5*scan);
    // sample the texture
    fragColor = vec4(mix(texture2D(iChannel0,uv).rgb,vec3(0.0),apply),1.0);
  }
}
// -- end original shader

void main(void)
{
    mainImage(gl_FragColor, fragCoord.xy);
}
`

// --- Custom Post-Processing Pipeline ---
class GlitchPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
	constructor(game) {
		super({ game: game, fragmentShader: fragmentShader, uniforms: ['uMainSampler', 'uTime', 'uGlitchAmount'] });
		this._glitchAmount = 0;
	}
	onPreRender() { this.set1f('uTime', this.game.loop.time * 0.001); this.set1f('uGlitchAmount', this._glitchAmount); }
	setGlitchAmount(amount) { this._glitchAmount = amount; }
}

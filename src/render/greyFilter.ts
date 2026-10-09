import { Filter, GlProgram } from "pixi.js";

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`;

// Grey land (ART_BIBLE.md §4): desaturate 85% keeping luminance, shift 4% cool, 45-degree ink
// hatch at 18% (1.5 px every 6 px, screen space). Premultiplied alpha throughout.
const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uAmount;
uniform float uPixel;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 g = mix(c.rgb, vec3(l), 0.85 * uAmount);
  g *= mix(vec3(1.0), vec3(0.97, 0.99, 1.04), uAmount);
  float d = mod(gl_FragCoord.x + gl_FragCoord.y, 6.0 * uPixel);
  float h = step(d, 1.5 * uPixel) * 0.18 * uAmount;
  g = mix(g, vec3(0.239, 0.204, 0.157) * c.a, h * c.a);
  finalColor = vec4(g, c.a);
}`;

export function createGreyFilter(pixelRatio: number): Filter {
  return new Filter({
    glProgram: GlProgram.from({ vertex, fragment, name: "grey-land" }),
    resources: {
      greyUniforms: {
        uAmount: { value: 1, type: "f32" },
        uPixel: { value: pixelRatio, type: "f32" },
      },
    },
  });
}

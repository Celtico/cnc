import { BufferAttribute, BufferGeometry, DataTexture, NearestFilter, PlaneGeometry, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector2 } from "three"
import { takeDirty, type Heightfield } from "./camHeightfield"
import type { SimProgram } from "./camSim"

/**
 * El 3D de la simulació de la Vista CAM (three, només des de `CamSim3D`, a demanda): la textura del mapa d'alçades,
 * el material que la pinta (la malla baixa fins a l'alçada que queda; el que és passant no es pinta i s'hi veu el
 * martiri) i les línies dels recorreguts.
 */

export function heightTexture(hf: Heightfield): DataTexture {
  const tex = new DataTexture(hf.data, hf.nx, hf.ny, RGBAFormat, UnsignedByteType)
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** Puja a la GPU només les files canviades (o tot, si és molt o s'ha refet). */
export function flushHeightTexture(hf: Heightfield, tex: DataTexture): boolean {
  const d = takeDirty(hf)
  if (!d) return false
  const cols = d.i1 - d.i0 + 1
  const rows = d.j1 - d.j0 + 1
  tex.clearUpdateRanges()
  if (rows * cols < 0.25 * hf.nx * hf.ny && rows < 256) for (let j = d.j0; j <= d.j1; j++) tex.addUpdateRange((j * hf.nx + d.i0) * 4, cols * 4)
  tex.needsUpdate = true
  return true
}

/** La cara de dalt: una malla més baixa que el mapa (la forma) i, a cada píxel, el mapa sencer (color, llum i forats). */
export function topGeometry(hf: Heightfield, maxSeg: number): PlaneGeometry {
  const sx = Math.min(hf.nx, maxSeg)
  const sy = Math.max(1, Math.min(hf.ny, Math.round((sx * hf.W) / hf.L)))
  const g = new PlaneGeometry(hf.L, hf.W, sx, sy)
  g.translate(hf.L / 2, hf.W / 2, 0)
  return g
}

const COMMON = /* glsl */ `
uniform sampler2D hTex;
uniform vec2 size;
uniform float T;
float code(vec2 uv) { return texture2D(hTex, uv).r * 255.0; }
float hAt(vec2 uv) { float c = code(uv); return c < 0.5 ? 0.0 : (c - 1.0) / 254.0 * T; }
`

const VERT = /* glsl */ `
${COMMON}
varying vec2 vXY;
void main() {
  vec3 p = position;
  p.z = hAt(p.xy / size);
  vXY = p.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

// Colors ja en sRGB (sense conversió: el material no passa per la gestió de color de three).
const FRAG = /* glsl */ `
${COMMON}
uniform vec2 texel;
uniform float cell;
varying vec2 vXY;
void main() {
  vec2 uv = vXY / size;
  vec4 s = texture2D(hTex, uv);
  float c = s.r * 255.0;
  if (c < 0.5) discard;
  float z = (c - 1.0) / 254.0 * T;
  float hx = hAt(uv + vec2(texel.x, 0.0)) - hAt(uv - vec2(texel.x, 0.0));
  float hy = hAt(uv + vec2(0.0, texel.y)) - hAt(uv - vec2(0.0, texel.y));
  vec3 n = normalize(vec3(-hx, -hy, 2.0 * cell));
  float d = clamp((T - z) / T, 0.0, 1.0);
  float grain = 0.5 + 0.5 * sin(vXY.y * 0.35 + sin(vXY.x * 0.004) * 6.0 + sin(vXY.x * 0.031) * 0.8);
  vec3 top = mix(vec3(0.84, 0.69, 0.50), vec3(0.72, 0.56, 0.38), grain * 0.45);
  vec3 cut = vec3(0.93, 0.83, 0.66);
  vec3 base = d > 0.003 ? mix(cut, cut * 0.62, d) : top;
  base = mix(base, vec3(0.55, 0.78, 0.5), s.g * 0.18);
  float lit = 0.5 + 0.6 * max(dot(n, normalize(vec3(-0.35, -0.55, 0.76))), 0.0);
  gl_FragColor = vec4(base * lit, 1.0);
}
`

export function heightMaterial(hf: Heightfield, tex: DataTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      hTex: { value: tex },
      size: { value: new Vector2(hf.nx * hf.cell, hf.ny * hf.cell) },
      texel: { value: new Vector2(1 / hf.nx, 1 / hf.ny) },
      cell: { value: hf.cell },
      T: { value: hf.T },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  })
}

/** Línies del programa: els talls (a sobre del tauler) i els ràpids (a la seva alçada); per operació, el tros dels talls. */
export function pathGeometries(prog: SimProgram): { cuts: BufferGeometry; current: BufferGeometry; rapids: BufferGeometry; ranges: Map<number, [number, number]> } {
  const cut: number[] = []
  const rapid: number[] = []
  const ranges = new Map<number, [number, number]>()
  const z = prog.T + 0.4
  for (const m of prog.moves) {
    if (Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) < 1e-6) continue
    if (m.kind === "rapid") {
      rapid.push(...m.a, ...m.b)
      continue
    }
    const r = ranges.get(m.op)
    if (r) r[1] += 2
    else ranges.set(m.op, [cut.length / 3, 2])
    cut.push(m.a[0], m.a[1], z, m.b[0], m.b[1], z)
  }
  const geo = (a: number[]) => {
    const g = new BufferGeometry()
    g.setAttribute("position", new BufferAttribute(new Float32Array(a), 3))
    return g
  }
  const cuts = geo(cut)
  // L'operació en curs: les mateixes línies (el mateix buffer) amb el seu `drawRange`.
  const current = new BufferGeometry()
  current.setAttribute("position", cuts.getAttribute("position"))
  current.setDrawRange(0, 0)
  return { cuts, current, rapids: geo(rapid), ranges }
}

// Thin WebGL2 helpers: program cache, fullscreen triangle, render-target pool.
import { VERT } from "./shaders";

export interface Program {
  prog: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export class GL {
  readonly gl: WebGL2RenderingContext;
  private programs = new Map<string, Program>();
  private vao: WebGLVertexArrayObject;
  private free: Target[] = [];
  private live = new Set<Target>();
  /** 1x1 transparent texture. */
  readonly empty: WebGLTexture;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.empty = this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.empty);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  program(key: string, frag: string): Program {
    let p = this.programs.get(key);
    if (p) return p;
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(`Shader compile failed (${key}): ${log}`);
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, "a_pos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Program link failed (${key}): ${gl.getProgramInfoLog(prog)}`);
    p = { prog, uniforms: new Map() };
    this.programs.set(key, p);
    return p;
  }

  createTexture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Upload a DOM image source (flipped to GL orientation). Optionally build mipmaps for strong downscales. */
  upload(tex: WebGLTexture, src: TexImageSource, mip = false): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  acquire(w: number, h: number): Target {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    const i = this.free.findIndex((t) => t.w === w && t.h === h);
    let t: Target;
    if (i >= 0) t = this.free.splice(i, 1)[0];
    else {
      const gl = this.gl;
      const tex = this.createTexture();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      t = { tex, fbo, w, h };
    }
    this.live.add(t);
    return t;
  }

  release(t: Target | null | undefined): void {
    if (!t || !this.live.has(t)) return;
    this.live.delete(t);
    this.free.push(t);
    // bound the pool
    while (this.free.length > 24) {
      const old = this.free.shift()!;
      this.gl.deleteTexture(old.tex);
      this.gl.deleteFramebuffer(old.fbo);
    }
  }

  /** Release every target still checked out (end-of-frame safety net). */
  releaseAll(keep: Set<Target> = new Set()): void {
    for (const t of [...this.live]) if (!keep.has(t)) this.release(t);
  }

  clear(t: Target | null, r = 0, g = 0, b = 0, a = 0): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    if (t) gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Draw a fullscreen pass into `out` (null = canvas). `textures` are bound to
   * units in order and assigned to the named sampler uniforms.
   */
  draw(p: Program, out: Target | null, textures: [string, WebGLTexture][], set: (u: (name: string) => WebGLUniformLocation | null) => void, viewport?: [number, number]): void {
    const gl = this.gl;
    gl.useProgram(p.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    if (out) gl.viewport(0, 0, out.w, out.h);
    else if (viewport) gl.viewport(0, 0, viewport[0], viewport[1]);
    const u = (name: string) => {
      if (!p.uniforms.has(name)) p.uniforms.set(name, gl.getUniformLocation(p.prog, name));
      return p.uniforms.get(name)!;
    };
    textures.forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u(name), i);
    });
    set(u);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of [...this.free, ...this.live]) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    this.free = [];
    this.live.clear();
    for (const p of this.programs.values()) gl.deleteProgram(p.prog);
    this.programs.clear();
  }
}

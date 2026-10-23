// Tiny filtergraph builder: collects inputs and labelled filter statements.

export class Graph {
  /** Per-input ffmpeg argument lists (each ends with "-i", path). */
  inputs: string[][] = [];
  stmts: string[] = [];
  warnings: string[] = [];
  private n = 0;

  label(prefix = "s"): string {
    return `${prefix}${this.n++}`;
  }

  /** Add an input; returns its index. */
  input(args: string[]): number {
    this.inputs.push(args);
    return this.inputs.length - 1;
  }

  /** Emit `[in1][in2]f1,f2[out]`. Inputs are labels without brackets (or "0:v"). Returns out label. */
  chain(inputs: string | string[] | null, filters: (string | false | null | undefined)[], out?: string): string {
    const fs = filters.filter((f): f is string => !!f);
    const ins = inputs === null ? [] : Array.isArray(inputs) ? inputs : [inputs];
    const o = out ?? this.label();
    if (!fs.length) {
      if (ins.length !== 1) throw new Error("empty chain needs exactly one input");
      fs.push(ins[0].includes(":a") ? "anull" : "null");
    }
    this.stmts.push(`${ins.map((i) => `[${i}]`).join("")}${fs.join(",")}[${o}]`);
    return o;
  }

  /** Split a stream into n copies. */
  split(input: string, n: number, audio = false): string[] {
    if (n === 1) return [input];
    const outs = Array.from({ length: n }, () => this.label());
    this.stmts.push(`[${input}]${audio ? "asplit" : "split"}=${n}${outs.map((o) => `[${o}]`).join("")}`);
    return outs;
  }

  /** Consume an unused stream. */
  sink(label: string, audio = false): void {
    this.stmts.push(`[${label}]${audio ? "anullsink" : "nullsink"}`);
  }

  script(): string {
    return this.stmts.join(";\n");
  }

  inputArgs(): string[] {
    return this.inputs.flat();
  }
}

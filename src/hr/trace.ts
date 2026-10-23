/** One bpm value per second of the ride; 0 marks a second without signal. */
export class TraceRecorder {
  private values: number[];

  constructor(initial: number[] = []) {
    this.values = [...initial];
  }

  record(sec: number, bpm: number): void {
    while (this.values.length < sec) this.values.push(0);
    if (this.values.length === sec) this.values.push(bpm);
  }

  get length(): number {
    return this.values.length;
  }

  snapshot(): number[] {
    return [...this.values];
  }
}

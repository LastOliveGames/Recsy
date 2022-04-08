const encoder = new TextEncoder();

export class WireWriter {
  private buffer: ArrayBuffer;
  private dataView: DataView;
  private uint8View: Uint8Array;
  private outputView: Uint8Array | undefined;
  private offset: number;
  private length: number;

  constructor(length = 1024) {
    this.buffer = new ArrayBuffer(length);
    this.dataView = new DataView(this.buffer);
    this.uint8View = new Uint8Array(this.buffer);
    this.reset();
  }

  reset(): void {
    this.offset = 0;
    this.length = 0;
  }

  rewind(): void {
    this.length = this.offset;
    this.offset = 0;
  }

  get maxOutputLength(): number {
    return this.buffer.byteLength;
  }

  get output(): Uint8Array {
    if (!this.outputView) {
      this.outputView = new Uint8Array(this.buffer, 0, Math.max(this.offset, this.length));
    }
    return this.outputView;
  }

  copyOutput(): ArrayBuffer {
    return this.buffer.slice(0, Math.max(this.offset, this.length));
  }

  int8(value: number): this {
    this.outputView = undefined;
    this.dataView.setInt8(this.offset, value);
    this.offset += 1;
    return this;
  }

  uint8(value: number): this {
    this.outputView = undefined;
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
    return this;
  }

  int16(value: number): this {
    this.outputView = undefined;
    this.dataView.setInt16(this.offset, value, true);
    this.offset += 2;
    return this;
  }

  uint16(value: number): this {
    this.outputView = undefined;
    this.dataView.setUint16(this.offset, value, true);
    this.offset += 2;
    return this;
  }

  int32(value: number): this {
    this.outputView = undefined;
    this.dataView.setInt32(this.offset, value, true);
    this.offset += 4;
    return this;
  }

  uint32(value: number): this {
    this.outputView = undefined;
    this.dataView.setUint32(this.offset, value, true);
    this.offset += 4;
    return this;
  }

  float32(value: number): this {
    this.outputView = undefined;
    this.dataView.setFloat32(this.offset, value, true);
    this.offset += 4;
    return this;
  }

  float64(value: number): this {
    this.outputView = undefined;
    this.dataView.setFloat64(this.offset, value, true);
    this.offset += 8;
    return this;
  }

  utf8(value: string): this {
    this.outputView = undefined;
    const encodedString = encoder.encode(value);
    this.uint16(encodedString.byteLength);
    this.uint8View.set(encodedString, this.offset);
    this.offset += encodedString.byteLength;
    return this;
  }

  bytes(data: Uint8Array): this {
    this.outputView = undefined;
    this.uint8View.set(data, this.offset);
    this.offset += data.byteLength;
    return this;
  }
}

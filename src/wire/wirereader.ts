const decoder = new TextDecoder();

export class WireReader {
  private buffer: ArrayBuffer;
  private dataView: DataView;
  private offset: number;

  reset(buffer: ArrayBuffer): void {
    this.buffer = buffer;
    this.dataView = new DataView(buffer);
    this.offset = 0;
  }

  int8(): number {
    const value = this.dataView.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  uint8(): number {
    const value = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  int16(): number {
    const value = this.dataView.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  uint16(): number {
    const value = this.dataView.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  int32(): number {
    const value = this.dataView.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  uint32(): number {
    const value = this.dataView.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  float32(): number {
    const value = this.dataView.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  float64(): number {
    const value = this.dataView.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  utf8(): string {
    const length = this.uint16();
    const value = decoder.decode(new Uint8Array(this.buffer, this.offset, length));
    this.offset += length;
    return value;
  }
}

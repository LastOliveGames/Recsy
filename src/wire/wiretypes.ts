import type {WireReader} from './wirereader';
import type {WireWriter} from './wirewriter';

export interface WireType {
  read(wire: WireReader, currentValue?: any): any;
  write(wire: WireWriter, value: any): void;
}

export const int8: WireType = {
  read(wire) {return wire.int8();},
  write(wire, value) {wire.int8(value as number);}
};

export const uint8: WireType = {
  read(wire) {return wire.uint8();},
  write(wire, value) {wire.uint8(value as number);}
};

export const int16: WireType = {
  read(wire) {return wire.int16();},
  write(wire, value) {wire.int16(value as number);}
};

export const uint16: WireType = {
  read(wire) {return wire.uint16();},
  write(wire, value) {wire.uint16(value as number);}
};

export const int32: WireType = {
  read(wire) {return wire.int32();},
  write(wire, value) {wire.int32(value as number);}
};

export const uint32: WireType = {
  read(wire) {return wire.uint32();},
  write(wire, value) {wire.uint32(value as number);}
};

export const float32: WireType = {
  read(wire) {return wire.float32();},
  write(wire, value) {wire.float32(value as number);}
};

export const float64: WireType = {
  read(wire) {return wire.float64();},
  write(wire, value) {wire.float64(value as number);}
};

export const utf8: WireType = {
  read(wire) {return wire.utf8();},
  write(wire, value) {wire.utf8(value as string);}
};

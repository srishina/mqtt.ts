import {DecoderError} from '../client/errors'
import {getPropertyText} from './constants'

export class DataStreamDecoder {
    private dataView: DataView;
    private index: number;

    constructor(buf: ArrayBuffer) {
        this.dataView = new DataView(buf)
        this.index = 0
    }

    clone(): DataStreamDecoder {
        const dec = new DataStreamDecoder(this.dataView.buffer)
        dec.index = this.index
        return dec
    }

    remainigBuffer(): Uint8Array {
        return new Uint8Array(this.dataView.buffer, this.index)
    }

    remainingLength(): number {
        return this.dataView.byteLength - this.index
    }

    markBoundary(remainingLength: number): void {
        this.dataView = new DataView(this.dataView.buffer, this.index, remainingLength)
        // reset the index to 0, now we read from 0 ... remainingLength
        this.index = 0
    }

    skipBytes(num: number): void {
        this.index += num
    }

    decodeByte(): number | never {
        const b = this.dataView.getUint8(this.index)
        this.index += 1
        return b
    }

    decodeBool(): boolean | never {
        const b = this.decodeByte()
        return b ? true : false
    }

    decodeUint16(): number | never {
        const u16 = this.dataView.getUint16(this.index)
        this.index += 2
        return u16
    }

    decodeUint32(): number | never {
        const u32 = this.dataView.getUint32(this.index)
        this.index += 4
        return u32
    }

    tryDecodeVarUint32(): number {
        let multiplier = 1
        let value = 0
        let pos = this.index
        for (; ;) {
            if (pos == this.dataView.byteLength) {
                return -1
            }

            const bt = this.dataView.getUint8(pos++)
            value += (bt & 0x7F) * multiplier
            if (multiplier > 128 * 128 * 128) {
                throw new DecoderError('Variable integer contains value which is more than the permissible')
            }

            if ((bt & 0x80) == 0) {
                break
            }

            multiplier *= 128
        }

        this.skipBytes(pos - this.index)
        return value
    }

    decodeVarUint32(): number | never {
        let multiplier = 1
        let value = 0

        for (; ;) {
            const bt = this.decodeByte()
            value += (bt & 0x7F) * multiplier
            if ((bt & 0x80) == 0) {
                break
            }

            multiplier *= 128
            if (multiplier > 128 * 128 * 128) {
                throw new DecoderError('Variable integer contains value which is more than the permissible')
            }
        }

        return value
    }

    decodeBinaryData(): Uint8Array | never {
        const bufLen = this.decodeUint16()
        const data = new Uint8Array(bufLen)
        for (let i = 0; i < bufLen; i++) {
            data[i] = this.dataView.getUint8(this.index + i)
        }
        this.index += bufLen
        return data
    }

    decodeBinaryDataNoLength(lenToRead: number): Uint8Array | never {
        const data = new Uint8Array(lenToRead)
        for (let i = 0; i < lenToRead; i++) {
            data[i] = this.dataView.getUint8(this.index + i)
        }
        this.index += lenToRead
        return data
    }

    decodeUTF8String(): string | never {
        const data = this.decodeBinaryData()
        const utf8Dec = new TextDecoder()
        return utf8Dec.decode(data)
    }

    decodeUTF8StringPair(): {key: string, value: string} | never {
        const data = this.decodeBinaryData()
        const key = new TextDecoder().decode(data)
        const data2 = this.decodeBinaryData()
        const value = new TextDecoder().decode(data2)

        return {key: key, value: value}
    }
}

export class DataStreamEncoder {
    private buf: ArrayBuffer;
    private view: DataView;
    private index: number;

    constructor(bufLen: number) {
        this.buf = new ArrayBuffer(bufLen)
        this.view = new DataView(this.buf)
        this.index = 0
    }

    get indexVal(): number {
        return this.index
    }

    get buffer(): ArrayBuffer {
        return this.buf
    }

    get byteArray(): Uint8Array {
        return new Uint8Array(this.buf)
    }

    public encodeByte(b: number): void | never {
        this.view.setUint8(this.index, b)
        this.index += 1
    }

    public encodeBool(b: boolean): void | never {
        this.encodeByte(boolToByte(b))
    }

    public encodeUint16(u16: number): void | never {
        this.view.setUint16(this.index, u16)
        this.index += 2
    }

    public encodeUint32(u32: number): void | never {
        this.view.setUint32(this.index, u32)
        this.index += 4
    }

    public encodeVarUint32(u32: number): void | never {
        if (u32 > 268435455) {
            throw new DecoderError('Variable integer contains value which is more than the permissible')
        }

        const numBytes = 0

        do {
            let digit: number = u32 % 0x80
            u32 >>= 7

            if (u32 > 0) {
                digit |= 0x80
            }

            this.encodeByte(digit)
        } while ((u32 > 0) && (numBytes < 4))
    }

    public encodeBinaryData(data: Uint8Array): void | never {
        this.encodeUint16(data.length)
        for (let index = 0; index < data.length; ++index) {
            this.view.setUint8(this.index + index, data[index])
        }
        this.index += data.length
    }

    public encodeBinaryDataNoLength(data: Uint8Array): void | never {
        for (let index = 0; index < data.length; ++index) {
            this.view.setUint8(this.index + index, data[index])
        }
        this.index += data.length
    }

    public encodeUTF8String(str: string): void | never {
        const utf8Enc = new TextEncoder()
        const data = utf8Enc.encode(str)
        this.encodeBinaryData(data)
    }

    public encodeUTF8StringNoLength(str: string): void | never {
        const utf8Enc = new TextEncoder()
        const data = utf8Enc.encode(str)
        this.encodeBinaryDataNoLength(data)
    }
}

function boolToByte(b: boolean): number {
    return b ? 1 : 0
}

export function encodedVarUint32Size(val: number): number {
    let size = 0
    do {
        let encodedByte = val % 0x80
        val = val / 0x80
        if (val > 0) {
            encodedByte = encodedByte | 0x80
        }
        size++
    } while ((Math.trunc(val) != 0))
    return size
}

// the functions adds property ID length (1)
export abstract class PropertySizeIfNotEmpty {
    public static fromByte(val: number | undefined): number {
        return val ? 2 : 0
    }

    public static fromBool(val: boolean | undefined): number {
        return val ? 2 : 0
    }

    public static fromUint16(val: number | undefined): number {
        return val ? 3 : 0
    }

    public static fromUint32(val: number | undefined): number {
        return val ? 5 : 0
    }

    public static fromUTF8Str(val: string | undefined): number {
        return val ? val.length + 3 : 0
    }

    public static fromBinaryData(val: Uint8Array | undefined): number {
        return val ? val.length + 3 : 0
    }

    public static fromVarUin32(val: number | undefined): number {
        return val ? encodedVarUint32Size(val) + 1 : 0
    }

    public static fromVarUint32Array(values: number[] | undefined): number {
        let propertyLen = 0
        if (values) {
            values.forEach(el => {
                propertyLen += (encodedVarUint32Size(el) + 1)
            })
        }
        return propertyLen
    }

    public static fromUTF8StringPair(values: Map<string, string> | undefined): number {
        let propertyLen = 0
        if (values) {
            values.forEach((key, value) => {
                propertyLen += 1
                propertyLen += (4 + key.length + value.length)
            })
        }
        return propertyLen
    }
}

export abstract class PropertyEncoderIfNotEmpty {
    public static fromByte(enc: DataStreamEncoder, id: number, val: number | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeByte(val)
        }
    }

    public static fromBool(enc: DataStreamEncoder, id: number, val: boolean | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeBool(val)
        }
    }

    public static fromUint16(enc: DataStreamEncoder, id: number, val: number | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeUint16(val)
        }
    }

    public static fromUint32(enc: DataStreamEncoder, id: number, val: number | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeUint32(val)
        }
    }

    public static fromUTF8Str(enc: DataStreamEncoder, id: number, val: string | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeUTF8String(val)
        }
    }

    public static fromBinaryData(enc: DataStreamEncoder, id: number, val: Uint8Array | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeBinaryData(val)
        }
    }

    public static fromVarUint32(enc: DataStreamEncoder, id: number, val: number | undefined): void | never {
        if (val) {
            enc.encodeVarUint32(id)
            enc.encodeVarUint32(val)
        }
    }

    public static fromVarUint32Array(enc: DataStreamEncoder, id: number, values: number[] | undefined): void | never {
        if (values) {
            values.forEach(el => {
                enc.encodeVarUint32(id)
                enc.encodeVarUint32(el)
            })
        }
    }

    public static fromUTF8StringPair(enc: DataStreamEncoder, id: number, values: Map<string, string> | undefined): void | never {
        if (values) {
            values.forEach((value, key) => {
                enc.encodeVarUint32(id)
                enc.encodeUTF8String(key)
                enc.encodeUTF8String(value)
            })
        }
    }
}

export function throwMoreThanOnce(id: number): void | never {
    throw new Error(getPropertyText(id) + ' must not be included more than once')
}

export abstract class PropertyDecoderOnlyOnce {
    public static toByte(dec: DataStreamDecoder, id: number, val: number | undefined): number | never {
        if (val) {
            throwMoreThanOnce(id)
        }

        return dec.decodeUint32()
    }

    public static toBool(dec: DataStreamDecoder, id: number, val: boolean | undefined): boolean | never {
        if (val) {
            throwMoreThanOnce(id)
        }
        const b = dec.decodeByte()
        if (b != 0 && b != 1) {
            throw new Error('Wrong ' + getPropertyText(id) + ' must be 1 or 0, got ' + b)
        }
        return (b != 0)
    }

    public static toUint16(dec: DataStreamDecoder, id: number, val: number | undefined): number | never {
        if (val) {
            throwMoreThanOnce(id)
        }

        return dec.decodeUint16()
    }

    public static toUint32(dec: DataStreamDecoder, id: number, val: number | undefined): number | never {
        if (val) {
            throwMoreThanOnce(id)
        }

        return dec.decodeUint32()
    }

    public static toUTF8Str(dec: DataStreamDecoder, id: number, val: string | undefined): string | never {
        if (val) {
            throwMoreThanOnce(id)
        }
        return dec.decodeUTF8String()
    }

    public static toBinaryData(dec: DataStreamDecoder, id: number, val: Uint8Array | undefined): Uint8Array | never {
        if (val) {
            throwMoreThanOnce(id)
        }

        return dec.decodeBinaryData()
    }

    public static toVarUint32(dec: DataStreamDecoder, id: number, val: number | undefined): number | never {
        if (val) {
            throwMoreThanOnce(id)
        }

        return dec.decodeVarUint32()
    }
}

export function UTF8ToString(data: Uint8Array): string | never {
    const utf8Dec = new TextDecoder()
    return utf8Dec.decode(data)
}

export class PIDGenerator {
    private static maxValue = 65535;
    private usedIDs: Set<number>;
    private lastUsedID: number;

    public constructor() {
        this.usedIDs = new Set<number>()
        this.lastUsedID = 0
    }

    public nextID(): number | never {
        if (this.usedIDs.size >= PIDGenerator.maxValue) {
            throw new Error('All packet IDs are in use.')
        }

        for (; ;) {
            this.lastUsedID = (this.lastUsedID == PIDGenerator.maxValue) ? 1 : (this.lastUsedID + 1)
            if (this.usedIDs.has(this.lastUsedID)) {
                continue
            }
            this.usedIDs.add(this.lastUsedID)
            break
        }

        return this.lastUsedID
    }

    public freeID(id: number): void | never {
        if (this.usedIDs.has(id)) {
            this.usedIDs.delete(id)
        }
    }
}
/* eslint-disable  @typescript-eslint/no-explicit-any */
export class Deferred<T> {
    private resolveSelf?: (value: T | PromiseLike<T>) => void;
    private rejectSelf?: (reason?: any) => void;
    private promise: Promise<T>

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolveSelf = resolve
            this.rejectSelf = reject
        })
    }

    getPromise(): Promise<T> {
        return this.promise
    }

    resolve(value: T | PromiseLike<T>): void {
        if (this.resolveSelf !== undefined) {
            this.resolveSelf(value)
        }
        else {
            throw new Error('Attempt to resolve on undefined')
        }
    }

    /* eslint-disable @typescript-eslint/explicit-module-boundary-types */
    reject(reason?: any): void {
        if (this.rejectSelf !== undefined) {
            this.rejectSelf(reason)
        }
        else {
            throw new Error('Attempt to reject on undefined')
        }
    }
    /* eslint-enable @typescript-eslint/explicit-module-boundary-types */
}
/* eslint-enable  @typescript-eslint/no-explicit-any */

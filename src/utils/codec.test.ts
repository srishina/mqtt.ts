import {DataStreamEncoder, DataStreamDecoder, encodedVarUint32Size, PIDGenerator} from './codec'

import * as chai from 'chai'

const expect = chai.expect

describe('MQTT data stream enc/dec', () => {

    it('enc/dec byte', () => {
        const testValue = 0x64
        const enc = new DataStreamEncoder(1)
        expect(() => enc.encodeByte(testValue)).to.not.throw()
        const dec = new DataStreamDecoder(enc.buffer)
        expect(dec.decodeByte()).to.equal(testValue)
    })

    it('enc/dec bool', () => {
        const testValue = true
        const enc = new DataStreamEncoder(1)
        expect(() => enc.encodeBool(testValue)).to.not.throw()
        const dec = new DataStreamDecoder(enc.buffer)
        expect(dec.decodeBool()).to.equal(testValue)
    })

    it('enc/dec uint16', () => {
        const testValue = 128
        const enc = new DataStreamEncoder(2)
        expect(() => enc.encodeUint16(testValue)).to.not.throw()
        const dec = new DataStreamDecoder(enc.buffer)
        expect(dec.decodeUint16()).to.equal(testValue)
    })

    it('enc/dec uint32', () => {
        const testValue = 4096
        const enc = new DataStreamEncoder(4)
        expect(() => enc.encodeUint32(testValue)).to.not.throw()
        const dec = new DataStreamDecoder(enc.buffer)
        expect(dec.decodeUint32()).to.equal(testValue)
    })

    it('enc/dec varuin32', () => {
        const nums = new Map([
            [0, [0x00]],
            [127, [0x7F]],
            [128, [0x80, 0x01]],
            [16383, [0xFF, 0x7F]],
            [16384, [0x80, 0x80, 0x01]],
            [2097151, [0xFF, 0xFF, 0x7F]],
            [2097152, [0x80, 0x80, 0x80, 0x01]],
            [268435455, [0xFF, 0xFF, 0xFF, 0x7F]],
        ])

        nums.forEach(function(value, key) {
            const enc = new DataStreamEncoder(value.length)
            expect(() => enc.encodeVarUint32(key)).to.not.throw()
            expect([...new Uint8Array(enc.buffer)]).to.eql(value)

            const dec = new DataStreamDecoder(enc.buffer)
            expect(dec.decodeVarUint32()).to.equal(key)
            expect(dec.remainingLength()).to.equal(0)
        })

        const enc = new DataStreamEncoder(4)
        // Test encode error too big
        expect(() => enc.encodeVarUint32(268435455 + 1)).to.throw()

        // Test decode underflow(EOF) error, empty byte array
        const dec = new DataStreamDecoder(new ArrayBuffer(0))
        expect(() => dec.decodeVarUint32()).to.throw()

        // Test decode mid underflow(EOF) error, invalid byte array
        const array = new Uint8Array([0x80, 0x80, 0x80])
        const dec2 = new DataStreamDecoder(array.buffer)
        expect(() => dec2.decodeVarUint32()).to.throw()
    })

    it('dec varuin32 partial', () => {
        const buf = new Uint8Array([0x80, 0x80])

        const dec = new DataStreamDecoder(buf.buffer)
        expect(dec.tryDecodeVarUint32()).to.equal(-1)
    })

    it('enc/dec UTF8 string', () => {
        const strs = new Map([
            ['hello', [0x00, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F]],
            // ["\u0000FEFF", [0x00, 0x03, 0xEF, 0xBB, 0xBF]] // MQTT-1.5.4-3 fixme?
        ])

        strs.forEach(function(value, key) {
            const enc = new DataStreamEncoder(value.length)
            expect(() => enc.encodeUTF8String(key)).to.not.throw()
            expect([...new Uint8Array(enc.buffer)]).to.eql(value)

            const dec = new DataStreamDecoder(enc.buffer)
            expect(dec.decodeUTF8String()).to.equal(key)
        })

        // Test decode underflow(EOF) error, empty byte array
        const dec = new DataStreamDecoder(new ArrayBuffer(0))
        expect(() => dec.decodeUTF8String()).to.throw()

        // Test decode mid underflow(EOF) error, invalid byte array
        const array = new Uint8Array([0x00, 0x05, 0x68, 0x65])
        const dec2 = new DataStreamDecoder(array.buffer)
        expect(() => dec2.decodeUTF8String()).to.throw()
    })

    it('Variable Uint32 encoding size', () => {
        expect(encodedVarUint32Size(0)).to.equal(1)
        expect(encodedVarUint32Size(127)).to.equal(1)
        expect(encodedVarUint32Size(128)).to.equal(2)
        expect(encodedVarUint32Size(16384)).to.equal(3)
        expect(encodedVarUint32Size(268435455)).to.equal(4)
    })

    it('packet ID generator test', () => {
        const pidgen = new PIDGenerator()

        expect(pidgen.nextID()).to.equal(1)
        expect(pidgen.nextID()).to.equal(2)
        expect(() => pidgen.freeID(2)).to.not.throw()
        expect(pidgen.nextID()).to.equal(3)
        expect(pidgen.nextID()).to.equal(4)
    })

    it('packet ID generator - exhaust ids test', () => {
        const pidgen = new PIDGenerator()

        for (let step = 0; step < 65535; step++) {
            pidgen.nextID()
        }
        expect(() => pidgen.nextID()).to.throw()
        expect(() => pidgen.freeID(1024)).to.not.throw()
        expect(() => pidgen.freeID(1025)).to.not.throw()
        expect(pidgen.nextID()).to.equal(1024)
        expect(pidgen.nextID()).to.equal(1025)
    })
})

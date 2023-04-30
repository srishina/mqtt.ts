import * as chai from 'chai'
import type { MQTTConnect } from './connect'
import { encodeConnectPacket } from './connect'

const expect = chai.expect

describe('MQTT CONNECT packet tests', () => {
    it('CONNECT packet test', () => {
        const encoded = new Uint8Array([0x10, 0x1B,
            0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // MQTT
            0x05, // protocol version
            0xC2,
            0x00, 0x18, // Keep alive - 24
            0x00,       // properties
            0x00, 0x00, // client id
            0x00, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F, // username - "hello"
            0x00, 0x05, 0x77, 0x6F, 0x72, 0x6C, 0x64, // password - "world"
        ])
        const connBuf: MQTTConnect = { cleanStart: true, keepAlive: 24, properties: {}, userName: 'hello', password: new TextEncoder().encode('world') }
        expect(encodeConnectPacket(connBuf)).to.eql(encoded)
    })

    it('CONNECT packet test with properties', () => {
        const encoded = new Uint8Array([0x10, 0x23,
            0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // MQTT
            0x05, // protocol version
            0xC2,
            0x00, 0x18, // Keep alive - 24
            0x08,       // properties
            0x21, 0x00, 0x0A, // receive maximum
            0x27, 0x00, 0x00, 0x04, 0x00,  // maximum packet size
            0x00, 0x00, // client id
            0x00, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F, // username - "hello"
            0x00, 0x05, 0x77, 0x6F, 0x72, 0x6C, 0x64, // password - "world"
        ])
        const connBuf: MQTTConnect = {
            cleanStart: true, keepAlive: 24,
            userName: 'hello', password: new TextEncoder().encode('world'), properties: { receiveMaximum: 10, maximumPacketSize: 1024 }
        }
        expect(encodeConnectPacket(connBuf)).to.eql(encoded)
    })

    it('CONNECT packet test with Will properties', () => {
        const encoded = new Uint8Array([0x10, 0x38,
            0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // MQTT
            0x05, // protocol version
            0xCE,
            0x00, 0x18, // Keep alive - 24
            0x08,       // properties
            0x21, 0x00, 0x0A, // receive maximum
            0x27, 0x00, 0x00, 0x04, 0x00,  // maximum packet size
            0x00, 0x00, // client id
            0x05,
            0x18, 0x00, 0x00, 0x04, 0x00,
            0x00, 0x03, 0x61, 0x2F, 0x62,
            0x00, 0x08, 0x57, 0x65, 0x6C, 0x63, 0x6F, 0x6D, 0x65, 0x21,
            0x00, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F, // username - "hello"
            0x00, 0x05, 0x77, 0x6F, 0x72, 0x6C, 0x64, // password - "world"
        ])
        const connBuf: MQTTConnect = {
            cleanStart: true, keepAlive: 24,
            willProperties: { willDelayInterval: 1024 },
            willQoS: 1,
            willTopic: 'a/b',
            willPayload: 'Welcome!',
            userName: 'hello', password: new TextEncoder().encode('world'), properties: { receiveMaximum: 10, maximumPacketSize: 1024 }
        }
        expect(encodeConnectPacket(connBuf)).to.eql(encoded)
    })
})

import * as chai from 'chai';
import {DataStreamDecoder} from '../utils/codec';
import {decodeDisconnectPacket, encodeDisconnectPacket, MQTTDisconnectReason} from './disconnect';

const expect = chai.expect;

describe('MQTT DISCONNECT packet tests', () => {
    it('DISCONNECT packet test with session expiry interval property', () => {
        const encoded = new Uint8Array([0xE0, 0x07,
            0x00,
            0x05,
            0x11, // SessionIntervalPropertyID
            0x00, 0x00, 0x00, 0x05 // session interval = 5
        ]);

        const disconnBuf = encodeDisconnectPacket({reasonCode: MQTTDisconnectReason.Code.NormalDisconnection, properties: {sessionExpiryInterval: 5}});
        expect(disconnBuf).to.eql(encoded);
    });

    it('DISCONNECT invalid packet test - property included more than once', () => {
        const encoded = new Uint8Array([0xE0, 0x07,
            0x00,
            0x0A,
            0x11, // SessionIntervalPropertyID
            0x00, 0x00, 0x00, 0x05, // session interval = 5
            0x11, // SessionIntervalPropertyID
            0x00, 0x00, 0x00, 0x05 // session interval = 5
        ]);

        const decoder = new DataStreamDecoder(encoded.buffer);
        expect(() => decodeDisconnectPacket(decoder)).to.throw();
    });

    it('DISCONNECT packet test no properties', () => {
        const encoded = new Uint8Array([0xE0, 0x00]);
        const disconnBuf = encodeDisconnectPacket({reasonCode: MQTTDisconnectReason.Code.NormalDisconnection});
        expect(disconnBuf).to.eql(encoded);
    });
});

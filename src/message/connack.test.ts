import * as chai from 'chai';
import {DataStreamDecoder} from '../utils/codec';
import {PropertyID} from '../utils/constants';
import {decodeConnAckPacket, MQTTConnAckReason} from './connack';

const expect = chai.expect;

describe('MQTT CONNACK packet tests', () => {
    it('CONNACK packet test', () => {
        const encoded = new Uint8Array([0x01, // session present
            MQTTConnAckReason.Code.NotAuthorized, // reason code not authorized
            0x05,
            PropertyID.SessionExpiryIntervalID,
            0x00, 0x00, 0x00, 0x0A
        ]);
        const decoder = new DataStreamDecoder(encoded.buffer);
        const connAck = decodeConnAckPacket(decoder);
        expect(connAck.sessionPresent).to.true;
        expect(connAck.reasonCode).to.eql(MQTTConnAckReason.Code.NotAuthorized);
        expect(connAck.sessionExpiryInterval).to.eql(10);
    });

    it('CONNACK invalid packet test - property included more than once', () => {
        const encoded = new Uint8Array([0x01, // session present
            MQTTConnAckReason.Code.NotAuthorized, // reason code not authorized
            0x0A,
            PropertyID.SessionExpiryIntervalID,
            0x00, 0x00, 0x00, 0x0A,
            PropertyID.SessionExpiryIntervalID,
            0x00, 0x00, 0x00, 0x0A
        ]);
        const decoder = new DataStreamDecoder(encoded.buffer);
        expect(() => decodeConnAckPacket(decoder)).to.throw();
    });
});

import {PacketType} from '../utils/constants';

import * as chai from 'chai';
import {buildHeaderOnlyPacket} from './packet';
import {DataStreamDecoder} from './../utils/codec';

const expect = chai.expect;
describe('MQTT packet tests', () => {
    //     // e.g PINGREQ, PINGRESP
    it('HEADER ONLY packet test', () => {
        const encoded = new Uint8Array([0xD0, 0x00]);
        const buffer = buildHeaderOnlyPacket(PacketType.PINGRESP);
        expect(buffer).to.eql(encoded);
        const decoder = new DataStreamDecoder(buffer.buffer);
        expect(PacketType.PINGRESP).to.eql(decoder.decodeByte() >> 4);
        expect(0).to.eql(decoder.tryDecodeVarUint32());
    });
});

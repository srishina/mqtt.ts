import * as chai from 'chai';
import {PropertyID} from '../utils/constants';
import {MQTTPubCompPacket, MQTTPubCompReason} from './pubcomp';

const expect = chai.expect;
describe('MQTT PUBCOMP test', () => {
    it('PUBCOMP packet test with success code and no properties', () => {
        const id = 0x12;
        const encoded = new Uint8Array([
            0x70, // PUBCOMP,
            0x02,
            0x00, id,
        ]);

        const pubcomp = new MQTTPubCompPacket(id, {reason: MQTTPubCompReason.Code.Success});
        expect(pubcomp.build()).to.eql(encoded);
    });

    it('PUBCOMP packet test with properties', () => {
        const id = 0x12;
        const reasonString = "abc";
        const reasonBytes = new Uint8Array([
            0x00, 0x03, 0x61, 0x62, 0x63,
        ]);
        const encoded = new Uint8Array([
            0x70, // PUBCOMP,
            0x0A,
            0x00, id,
            MQTTPubCompReason.Code.Success,
            0x06,
            PropertyID.ReasonStringID,
            ...reasonBytes
        ]);

        const pubcomp = new MQTTPubCompPacket(id, {reason: MQTTPubCompReason.Code.Success, reasonString: reasonString});
        expect(pubcomp.build()).to.eql(encoded);
    });
});
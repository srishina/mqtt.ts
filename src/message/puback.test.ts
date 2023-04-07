import * as chai from 'chai'
import {PropertyID} from '../utils/constants'
import {MQTTPubAckPacket, MQTTPubAckReason} from './puback'

const expect = chai.expect
describe('MQTT PUBACK test', () => {
    it('PUBACK packet test with success code and no properties', () => {
        const id = 0x12
        const encoded = new Uint8Array([
            0x40, // PUBACK
            0x02,
            0x00, id,
        ])

        const puback = new MQTTPubAckPacket(id, {reason: MQTTPubAckReason.Code.Success})
        expect(puback.build()).to.eql(encoded)
    })

    it('PUBACK packet test with non-success code and no properties', () => {
        const id = 0x12
        const encoded = new Uint8Array([
            0x40, // PUBACK
            0x04,
            0x00, id,
            MQTTPubAckReason.Code.PacketIdentifierInUse,
            0x00
        ])
        const pubrel = new MQTTPubAckPacket(id, {reason: MQTTPubAckReason.Code.PacketIdentifierInUse})
        expect(pubrel.build()).to.eql(encoded)
    })

    it('PUBACK packet test with properties', () => {
        const id = 0x12
        const reasonString = "abc"
        const reasonBytes = new Uint8Array([
            0x00, 0x03, 0x61, 0x62, 0x63,
        ])
        const encoded = new Uint8Array([
            0x40, // PUBACK
            0x0A,
            0x00, id,
            MQTTPubAckReason.Code.Success,
            0x06,
            PropertyID.ReasonStringID,
            ...reasonBytes
        ])

        const pubrel = new MQTTPubAckPacket(id, {reason: MQTTPubAckReason.Code.Success, properties: {reasonString: reasonString}})
        expect(pubrel.build()).to.eql(encoded)
    })
})

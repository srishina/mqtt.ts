import * as chai from 'chai'
import {PropertyID} from '../utils/constants'
import {MQTTPubRecPacket, MQTTPubRecReason} from './pubrec'

const expect = chai.expect
describe('MQTT PUBREC test', () => {
    it('PUBREC packet test with success code and no properties', () => {
        const id = 0x12
        const encoded = new Uint8Array([
            0x50, // PUBREC
            0x02,
            0x00, id,
        ])

        const pubrec = new MQTTPubRecPacket(id, {reason: MQTTPubRecReason.Code.Success})
        expect(pubrec.build()).to.eql(encoded)
    })

    it('PUBREC packet test with non-success code and no properties', () => {
        const id = 0x12
        const encoded = new Uint8Array([
            0x50, // PUBREC
            0x04,
            0x00, id,
            MQTTPubRecReason.Code.NoMatchingSubscribers,
            0x00
        ])

        const pubrec = new MQTTPubRecPacket(id, {reason: MQTTPubRecReason.Code.NoMatchingSubscribers})
        expect(pubrec.build()).to.eql(encoded)
    })

    it('PUBREC packet test with properties', () => {
        const id = 0x12
        const reasonString = "abc"
        const reasonBytes = new Uint8Array([
            0x00, 0x03, 0x61, 0x62, 0x63,
        ])
        const encoded = new Uint8Array([
            0x50, // PUBREC
            0x0A,
            0x00, id,
            MQTTPubRecReason.Code.Success,
            0x06,
            PropertyID.ReasonStringID,
            ...reasonBytes
        ])

        const pubcomp = new MQTTPubRecPacket(id, {reason: MQTTPubRecReason.Code.Success, properties: {reasonString: reasonString}})
        expect(pubcomp.build()).to.eql(encoded)
    })
})

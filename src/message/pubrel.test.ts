import * as chai from 'chai'
import {PropertyID} from '../utils/constants'
import {MQTTPubRelPacket, MQTTPubRelReason} from './pubrel'

const expect = chai.expect
describe('MQTT PUBREL test', () => {
    it('PUBREL packet test with success code and no properties', () => {
        const id = 0x12
        const encoded = new Uint8Array([
            0x62, // PUBREL
            0x02,
            0x00, id,
        ])

        const pubrel = new MQTTPubRelPacket(id, {reason: MQTTPubRelReason.Code.Success})
        expect(pubrel.build()).to.eql(encoded)
    })

    it('PUBREL packet test with non-success code and no properties', () => {
        const id = 0x12
        const encoded = new Uint8Array([
            0x62, // PUBREL
            0x04,
            0x00, id,
            MQTTPubRelReason.Code.PacketIdentifierNotFound,
            0x00
        ])
        const pubrel = new MQTTPubRelPacket(id, {reason: MQTTPubRelReason.Code.PacketIdentifierNotFound})
        expect(pubrel.build()).to.eql(encoded)
    })

    it('PUBREL packet test with properties', () => {
        const id = 0x12
        const reasonString = 'abc'
        const reasonBytes = new Uint8Array([
            0x00, 0x03, 0x61, 0x62, 0x63,
        ])
        const encoded = new Uint8Array([
            0x62, // PUBREL
            0x0A,
            0x00, id,
            MQTTPubRelReason.Code.Success,
            0x06,
            PropertyID.ReasonStringID,
            ...reasonBytes
        ])

        const pubrel = new MQTTPubRelPacket(id, {reason: MQTTPubRelReason.Code.Success, properties: {reasonString: reasonString}})
        expect(pubrel.build()).to.eql(encoded)
    })
})

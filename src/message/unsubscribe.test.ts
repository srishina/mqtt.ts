import * as chai from 'chai'
import type { MQTTUnsubscribe } from './unsubscribe'
import { UnsubscribePacket } from './unsubscribe'

const expect = chai.expect
describe('MQTT UNSUBSCRIBE tests', () => {
    it('UNSUBSCRIBE packet test', () => {
        const encoded = new Uint8Array([
            0xA2, 0x0F,
            0x00, 0x10, // Packet identifier 16
            0x00, // no properties
            0x00, 0x03, 0x66, 0x6F, 0x6F,
            0x00, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F,
        ])

        const unsub: MQTTUnsubscribe = { topicFilters: ['foo', 'hello'] }
        expect(new UnsubscribePacket(16, unsub).build()).to.eql(encoded)
    })
})

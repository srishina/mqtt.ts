import type { MQTTSubscription, MQTTSubscribe } from './subscribe'
import { SubscribePacket } from './subscribe'

import * as chai from 'chai'

const expect = chai.expect
describe('MQTT SUBSCRIBE data model tests', () => {

    it('SUBSCRIBE packet test', () => {
        const encoded = new Uint8Array([
            0x82, 0x17,
            0x00, 0x12, // Packet identifier 18
            0x00,                            // no properties
            0x00, 0x03, 0x61, 0x2F, 0x62, 0x01, // a/b with QoS 1
            0x00, 0x03, 0x63, 0x2F, 0x64, 0x06,
            0x00, 0x05, 0x65, 0x2F, 0x66, 0x2F, 0x67, 0x00,
        ])

        const topicFilters: string[] = ['a/b', 'c/d', 'e/f/g']

        // with QoS 1
        const s: MQTTSubscription = { topicFilter: topicFilters[0], qos: 1 }

        // with QoS 2
        const s2: MQTTSubscription = { topicFilter: topicFilters[1], qos: 2, noLocal: true }

        // with QoS 0 - default
        const s3: MQTTSubscription = { topicFilter: topicFilters[2] }

        const subscribe: MQTTSubscribe = { subscriptions: [s, s2, s3] }
        const subscBuf = new SubscribePacket(18, subscribe)
        expect(subscBuf.build()).to.eql(encoded)
    })

    it('SUBSCRIBE packet test with properties', () => {
        const encoded = new Uint8Array([
            0x82, 0x0B,
            0x00, 0x12, // Packet identifier 18
            0x02,
            0x0B,
            0x0A,
            0x00, 0x03, 0x61, 0x2F, 0x62, 0x01, // a/b with QoS 1
        ])

        const topicFilters: string[] = ['a/b', 'c/d', 'e/f/g']

        // with QoS 1
        const s: MQTTSubscription = { topicFilter: topicFilters[0], qos: 1 }

        const subscribe: MQTTSubscribe = { subscriptions: [s], properties: { subscriptionIdentifer: 10 } }
        const subscBuf = new SubscribePacket(18, subscribe)
        expect(subscBuf.build()).to.eql(encoded)
    })
})

import type { MQTTPublish} from './publish'
import {decodePublishPacket, MQTTPublishPacket, getPayloadAsString} from './publish'

import * as chai from 'chai'
import {PropertyID} from '../utils/constants'
import {DataStreamDecoder} from '../utils/codec'

const expect = chai.expect
const identifer = 18 // Packet identifier 18
describe('MQTT PUBLISH basic test', () => {

    it('MQTT PUBLISH test', () => {
        const byte0 = 0x3B // PUBLISH, DUP, 1, RETAIN
        const encoded = new Uint8Array([
            byte0,
            0x10,
            0x00, 0x03, 0x61, 0x2F, 0x62,
            0x00, identifer,
            0x00, // no properties
            0x57, 0x65, 0x6C, 0x63, 0x6F, 0x6D, 0x65, 0x21,
        ])

        const topic = "a/b"
        const payload = "Welcome!"
        const pub: MQTTPublish = {dup: true, qos: 1, retain: true, topic: topic, payload: payload}
        expect(new MQTTPublishPacket(18, pub).build()).to.eql(encoded)

        // decode the packet, ignore the header flag and the remaining length as decoder expects
        // the data after the remaining length field
        const decoder = new DataStreamDecoder(encoded.buffer.slice(2))
        const {pktID, result} = decodePublishPacket(byte0, decoder)
        expect(pktID).to.eql(identifer)
        expect(result.qos).to.eql(1)
        expect(result.dup).to.true
        expect(result.retain).to.true
        expect(result.topic).to.eql(topic)
        expect(getPayloadAsString(result.payload)).to.eql(payload)
    })

    it('MQTT PUBLISH basic test with properties', () => {
        const byte0 = 0x3D // PUBLISH, DUP, 2, RETAIN
        const topicAliasID = 0x10
        const encoded = new Uint8Array([
            byte0,
            0x13,
            0x00, 0x03, 0x61, 0x2F, 0x62,
            0x00, 0x12, // Packet identifier 18
            0x03,
            PropertyID.TopicAliasID,
            0x00, topicAliasID,
            0x57, 0x65, 0x6C, 0x63, 0x6F, 0x6D, 0x65, 0x21,
        ])

        const topic = "a/b"
        const payload = "Welcome!"
        const pub: MQTTPublish = {dup: true, qos: 2, retain: true, topic: topic, properties: {topicAlias: topicAliasID}, payload: payload}
        expect(new MQTTPublishPacket(identifer, pub).build()).to.eql(encoded)

        const decoder = new DataStreamDecoder(encoded.buffer.slice(2))
        const {pktID, result} = decodePublishPacket(byte0, decoder)
        expect(pktID).to.eql(identifer)
        expect(result.qos).to.eql(2)
        expect(result.dup).to.true
        expect(result.retain).to.true
        expect(result.properties?.topicAlias).to.eql(topicAliasID)
        expect(result.topic).to.eql(topic)
        expect(getPayloadAsString(result.payload)).to.eql(payload)
    })

    it('MQTT PUBLISH test with QoS 0', () => {
        const byte0 = 0x31 // PUBLISH, NO-DUP, 0, RETAIN
        // no packet identifier present when QoS is 0
        const encoded = new Uint8Array([
            byte0,
            0x0E,
            0x00, 0x03, 0x61, 0x2F, 0x62,
            0x00, // no properties
            0x57, 0x65, 0x6C, 0x63, 0x6F, 0x6D, 0x65, 0x21,
        ])

        const topic = "a/b"
        const payload = "Welcome!"
        const pub: MQTTPublish = {retain: true, topic: topic, payload: payload}
        expect(new MQTTPublishPacket(18, pub).build()).to.eql(encoded)

        const decoder = new DataStreamDecoder(encoded.buffer.slice(2))
        const {pktID, result} = decodePublishPacket(byte0, decoder)
        expect(pktID).to.eql(0)
        expect(result.qos).to.eql(0)
        expect(result.dup).to.false
        expect(result.retain).to.true
        expect(result.topic).to.eql(topic)
        expect(getPayloadAsString(result.payload)).to.eql(payload)
    })

    it('MQTT PUBLISH test with QoS 0 and its properties', () => {
        const topicAliasID = 0x0F
        // no packet identifier present when QoS is 0
        const encoded = new Uint8Array([
            0x31, // PUBLISH, NO-DUP, 0, RETAIN
            0x11,
            0x00, 0x03, 0x61, 0x2F, 0x62,
            0x03,
            PropertyID.TopicAliasID,
            0x00, topicAliasID,
            0x57, 0x65, 0x6C, 0x63, 0x6F, 0x6D, 0x65, 0x21,
        ])

        const topic = "a/b"
        const payload = "Welcome!"
        const pub: MQTTPublish = {retain: true, topic: topic, properties: {topicAlias: topicAliasID}, payload: payload}
        expect(new MQTTPublishPacket(18, pub).build()).to.eql(encoded)
    })

    it('MQTT PUBLISH test with QoS 0 with user properties', () => {
        // no packet identifier present when QoS is 0
        const encoded = new Uint8Array([
            0x31, // PUBLISH, NO-DUP, 0, RETAIN
            0x1C,
            0x00, 0x03, 0x61, 0x2F, 0x62,
            0x0E,
            PropertyID.UserPropertyID,
            0x00, 0x01, 0x61,
            0x00, 0x01, 0x32,
            PropertyID.UserPropertyID,
            0x00, 0x01, 0x63,
            0x00, 0x01, 0x34,
            0x57, 0x65, 0x6C, 0x63, 0x6F, 0x6D, 0x65, 0x21,
        ])

        const userProperty: Map<string, string> = new Map([
            ["a", "2"],
            ["c", "4"],
        ])
        const topic = "a/b"
        const payload = "Welcome!"
        const pub: MQTTPublish = {retain: true, topic: topic, payload: payload, properties: {userProperty: userProperty}}
        expect(new MQTTPublishPacket(18, pub).build()).to.eql(encoded)
    })

})

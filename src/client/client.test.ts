import {MQTTClient} from './client';

import * as chai from 'chai';

import * as chaiAsPromised from 'chai-as-promised';
import {Deferred} from "../utils/codec";
import {MQTTPublish, getPayloadAsString} from "../message/publish";
import {MQTTSubAck, MQTTSubAckReason, MQTTSubscription} from '../message/subscribe';
import {MQTTConnAckReason} from '../message/connack';
import {Subscriber} from './protocolhandler';
import {testMockServer} from "./mockserver";
import {PacketType} from '../utils/constants';
import {MQTTSubscribe} from '../message/subscribe';
import {MQTTUnsubAck, MQTTUnsubAckReason} from '../message/unsubscribe';
import {MQTTPubAck, MQTTPubAckReason} from '../message/puback';
import {MQTTPubRec, MQTTPubRecReason} from '../message/pubrec';
import {MQTTPubRel, MQTTPubRelReason} from '../message/pubrel';
import {MQTTPubComp, MQTTPubCompReason} from '../message/pubcomp';
import {ResubscribeResult} from './eventhandler';

chai.use(chaiAsPromised);
const expect = chai.expect;

const testURLLocalhost = "ws://localhost:3000";
const testURL2 = "ws://localhost:9001"; // "ws://mqtt.eclipseprojects.io:80/mqtt";
const testURL = "ws://broker.hivemq.com:8000/mqtt";
const clientID = "test-client-mqttv5-abcd";

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('MQTT client connection test with a mock server', function () {
    this.timeout(3000);

    it('Simple MQTT Client connect/close', async () => {
        const server = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();
        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        expect(() => client.disconnect()).to.not.throw();
        server.stop();
    });

    it('Simple MQTT Client sub/unsub', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const responses = new Map<PacketType, MQTTSubAck | MQTTUnsubAck>(
            [
                [PacketType.SUBACK, {reasonCodes: [MQTTSubAckReason.Code.GrantedQoS2]}],
                [PacketType.UNSUBACK, {reasonCodes: [MQTTUnsubAckReason.Code.Success]}],
            ]
        );
        server.setResponses(responses);
        class TestSubscriber implements Subscriber {
            onData(msg: MQTTPublish): void {
                // do nothing
            }
        }

        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        const subscriber = new TestSubscriber();

        const s: MQTTSubscription = {topicFilter: 'subu/test/#', qos: 2};
        const suback = await client.subscribe({subscriptions: [s]}, subscriber);
        expect([...suback.reasonCodes]).to.have.members([2]);
        const unsuback = await client.unsubscribe({topicFilters: ['subu/test/#']});
        expect([...unsuback.reasonCodes]).to.have.members([0]);
        expect(() => client.disconnect()).to.not.throw();
        server.stop();
    });

    it('Simple MQTT Client auto resubscribe after a reconnect', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const responses = new Map<PacketType, MQTTSubAck | MQTTUnsubAck>(
            [
                [PacketType.SUBACK, {reasonCodes: [MQTTSubAckReason.Code.GrantedQoS2]}],
                [PacketType.UNSUBACK, {reasonCodes: [MQTTUnsubAckReason.Code.Success]}],
            ]
        );
        server.setResponses(responses);
        class TestSubscriber implements Subscriber {
            onData(msg: MQTTPublish): void {
                // do nothing
            }
        }

        let resubscribed: boolean = false;
        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        client.on("resubscription", (subscribe: MQTTSubscribe, result: ResubscribeResult) => {
            if (result.suback) {
                resubscribed = true;
            } else {
                expect.fail("Resubscription resulted in an error");
            }
        });
        const subscriber = new TestSubscriber();

        const s: MQTTSubscription = {topicFilter: 'subu/test/#', qos: 2};
        const suback = await client.subscribe({subscriptions: [s]}, subscriber);
        expect([...suback.reasonCodes]).to.have.members([2]);

        server.closeClientConnection();
        await delay(2000); // wait for 500ms, to reinitializes
        expect(resubscribed).to.true;

        const unsuback = await client.unsubscribe({topicFilters: ['subu/test/#']});
        expect([...unsuback.reasonCodes]).to.have.members([0]);
        expect(() => client.disconnect()).to.not.throw();
        server.stop();
    });

    it('Simple MQTT Client PUBLISH QoS 1', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const responses = new Map<PacketType, MQTTSubAck | MQTTUnsubAck | MQTTPubAck>(
            [
                [PacketType.PUBACK, {reason: MQTTPubAckReason.Code.Success}],
            ]
        );
        server.setResponses(responses);
        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        await client.publish({topic: 'subu/test/1', payload: "foo", qos: 1});
        expect(() => client.disconnect()).to.not.throw();
        server.stop();
    });

    it('Simple MQTT Client PUBLISH QoS 2', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const responses = new Map<PacketType, MQTTSubAck | MQTTUnsubAck | MQTTPubAck | MQTTPubRec | MQTTPubComp>(
            [
                [PacketType.PUBREC, {reason: MQTTPubRecReason.Code.Success}],
                [PacketType.PUBCOMP, {reason: MQTTPubCompReason.Code.Success}],
            ]
        );
        server.setResponses(responses);

        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        await client.publish({topic: 'subu/test/1', payload: "foo", qos: 2});
        expect(() => client.disconnect()).to.not.throw();
        server.stop();
    });

    it('Simple MQTT Client receive publish with QoS 0', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const mqttPublish = {topic: 'subu/test/1', payload: "foo"};
        const responses = new Map<PacketType, MQTTPublish | MQTTSubAck | MQTTUnsubAck>(
            [
                [PacketType.SUBACK, {reasonCodes: [MQTTSubAckReason.Code.GrantedQoS2]}],
                [PacketType.UNSUBACK, {reasonCodes: [MQTTUnsubAckReason.Code.Success]}],
                [PacketType.PUBLISH, mqttPublish],
            ]
        );
        server.setResponses(responses);
        server.setTriggerPublishOnSubscribe();

        class TestSubscriber implements Subscriber {
            public deferred: Deferred<MQTTPublish>;
            constructor() {
                this.deferred = new Deferred<MQTTPublish>();
            }

            onData(msg: MQTTPublish): void {
                this.deferred.resolve(msg);
            }
        }

        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        const subscriber = new TestSubscriber();

        const s: MQTTSubscription = {topicFilter: 'subu/test/#', qos: 2};
        const suback = await client.subscribe({subscriptions: [s]}, subscriber);
        expect([...suback.reasonCodes]).to.have.members([2]);

        const result = await subscriber.deferred.getPromise();
        expect(mqttPublish.topic).to.equal(result.topic);
        expect(mqttPublish.payload).to.equal(getPayloadAsString(result.payload));

        const unsuback = await client.unsubscribe({topicFilters: ['subu/test/#']});
        expect([...unsuback.reasonCodes]).to.have.members([0]);
        expect(() => client.disconnect()).to.not.throw();
        server.stop();
    });

    it('Simple MQTT Client receive publish with QoS 1', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const mqttPublish = {topic: 'subu/test/1', payload: "foo", qos: 1};
        const responses = new Map<PacketType, MQTTPublish | MQTTSubAck | MQTTUnsubAck>(
            [
                [PacketType.SUBACK, {reasonCodes: [MQTTSubAckReason.Code.GrantedQoS2]}],
                [PacketType.UNSUBACK, {reasonCodes: [MQTTUnsubAckReason.Code.Success]}],
                [PacketType.PUBLISH, mqttPublish],
            ]
        );
        server.setResponses(responses);
        server.setTriggerPublishOnSubscribe();

        class TestSubscriber implements Subscriber {
            public deferred: Deferred<MQTTPublish>;
            constructor() {
                this.deferred = new Deferred<MQTTPublish>();
            }

            onData(msg: MQTTPublish): void {
                this.deferred.resolve(msg);
            }
        }

        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        const subscriber = new TestSubscriber();

        const s: MQTTSubscription = {topicFilter: 'subu/test/#', qos: 2};
        const suback = await client.subscribe({subscriptions: [s]}, subscriber);
        expect([...suback.reasonCodes]).to.have.members([2]);

        const result = await subscriber.deferred.getPromise();
        expect(mqttPublish.topic).to.equal(result.topic);
        expect(mqttPublish.qos).to.equal(result.qos);
        expect(mqttPublish.payload).to.equal(getPayloadAsString(result.payload));

        const unsuback = await client.unsubscribe({topicFilters: ['subu/test/#']});
        expect([...unsuback.reasonCodes]).to.have.members([0]);
        expect(() => client.disconnect()).to.not.throw();

        expect(server.isPublishAckd()).to.true;
        server.stop();
    });

    it('Simple MQTT Client receive publish with QoS 2', async () => {
        const server: testMockServer = new testMockServer({sessionPresent: false, reasonCode: MQTTConnAckReason.Code.Success});
        server.start();

        const mqttPublish = {topic: 'subu/test/1', payload: "foo", qos: 2};
        const responses = new Map<PacketType, MQTTPublish | MQTTSubAck | MQTTUnsubAck | MQTTPubRel>(
            [
                [PacketType.SUBACK, {reasonCodes: [MQTTSubAckReason.Code.GrantedQoS2]}],
                [PacketType.UNSUBACK, {reasonCodes: [MQTTUnsubAckReason.Code.Success]}],
                [PacketType.PUBLISH, mqttPublish],
                [PacketType.PUBREL, {reason: MQTTPubRelReason.Code.Success}],
            ]
        );
        server.setResponses(responses);
        server.setTriggerPublishOnSubscribe();

        class TestSubscriber implements Subscriber {
            public deferred: Deferred<MQTTPublish>;
            constructor() {
                this.deferred = new Deferred<MQTTPublish>();
            }

            onData(msg: MQTTPublish): void {
                this.deferred.resolve(msg);
            }
        }

        const client = await MQTTClient.connect(testURLLocalhost, {cleanStart: true, keepAlive: 0}, 2000);
        const subscriber = new TestSubscriber();

        const s: MQTTSubscription = {topicFilter: 'subu/test/#', qos: 2};
        const suback = await client.subscribe({subscriptions: [s]}, subscriber);
        expect([...suback.reasonCodes]).to.have.members([2]);

        const result = await subscriber.deferred.getPromise();
        expect(mqttPublish.topic).to.equal(result.topic);
        expect(mqttPublish.qos).to.equal(result.qos);
        expect(mqttPublish.payload).to.equal(getPayloadAsString(result.payload));

        const unsuback = await client.unsubscribe({topicFilters: ['subu/test/#']});
        expect([...unsuback.reasonCodes]).to.have.members([0]);
        expect(() => client.disconnect()).to.not.throw();

        expect(server.isPublishAckd()).to.true;
        server.stop();
    });
});

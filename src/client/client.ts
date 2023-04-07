import type { Subscriber} from "./protocolhandler"
import {ProtocolHandler} from "./protocolhandler"
import type {MQTTPublish} from "../message/publish"
import type {MQTTSubAck, MQTTSubscribe} from "../message/subscribe"
import type {MQTTUnsubAck, MQTTUnsubscribe} from "../message/unsubscribe"
import type {MQTTConnAck} from "../message/connack"
import type {MQTTConnect} from "../message/connect"

import type {MessageEvents} from "./eventhandler"

import {EventEmitter} from "events"
import type TypedEmitter from "typed-emitter"
import type {MQTTDisconnect} from "../message/disconnect"
import { MQTTDisconnectReason} from "../message/disconnect"
import type {MQTTStatstics} from "../utils/constants"
import type {Options} from "./options"

const defaultOpts = {
    timeout: 2000,
    initialReconnectDelay: 1000, // 1 sec
    maxReconnectDelay: 32000, // 32 sec
    jitter: 0.5,
}

/**
 * MQTT Client object
 */
export class MQTTClient extends (EventEmitter as new () => TypedEmitter<MessageEvents>) {
    private protocolHandler!: ProtocolHandler;
    private uri: string;

    /**
     * constructor
     * @param url MQTT broker where the client should attempt a connection
     */
    constructor(uri: string, options: Partial<Options> = {}) {
        super()
        this.protocolHandler = new ProtocolHandler(uri, Object.assign(defaultOpts, options), this)
        this.uri = uri
    }

    getURL(): string {
        return this.uri
    }

    /**
     * connect to the specified MQTT broker
     * Returns a Promise that when resolved, indicates that the connection is successful
     * and MQTTConnAck object is returned.
     * @param msg MQTT protocol CONNECT parameter
     * @param timeout
     */
    connect(msg: MQTTConnect): Promise<MQTTConnAck> {
        return new Promise((resolve, reject) => {
            this.protocolHandler.connect(msg)
                .then((connack) => {
                    resolve(connack)
                }).catch((err) => {
                    reject(err)
                })
        })
    }

    /**
     * Returns the client statistics, such as the number of bytes sent, received etc..
     * @see MQTTStatstics
     */
    getStatistics(): MQTTStatstics {
        return this.protocolHandler.getStatistics()
    }

    /**
     * send MQTT DISCONNECT packet and closes the connection with the to the MQTT broker.
     */
    disconnect(msg?: MQTTDisconnect): void | never {
        this.protocolHandler.disconnect(msg ? msg : {reasonCode: MQTTDisconnectReason.Code.NormalDisconnection})
    }

    /**
     * send MQTT PUBLISH packet to the MQTT broker.
     * Returns a Promise that when resolved, indicates that the MQTT PUBLISH operation is completed
     * When the QoS is 1 or 2 the promise resolves once the response from the broker is received and
     * for QoS 0 the promise resolves immediatly after the PUBLISH message is schedule to send.
     * @param msg MQTT protocol PUBLISH parameter @see MQTTPublish
     * @return Promise<void>
     */
    publish(msg: MQTTPublish): Promise<void> {
        return this.protocolHandler.sendPublish(msg)
    }

    /**
     * send MQTT SUBSCRIBE request to the broker with the given MQTTSubscribe parameter and a
     * callback handler(@see Subscriber) through which the published messages are returned for the given subscribed topics.
     * The given topic filters are validated before send.
     * Returns a Promise that when resolved, indicates that the MQTT SUBSCRIBE operation is completed
     * and the resulting MQTTSubAck can be inspected to verify the status of the subscription.
     * Note: the input MQTTSubscribe parameter can contain more than one topic, the associated
     * Subscriber is valid for all the topics present in the given MQTTSubscribe.
     * @param msg MQTT protocol SUBSCRIBE parameter, @see MQTTSubscribe
     * @param subscriber callback handler
     * @return Promise<MQTTSubAck> @see MQTTSubAck
     */
    subscribe(msg: MQTTSubscribe, subscriber: Subscriber): Promise<MQTTSubAck> {
        return this.protocolHandler.sendSubscribe(msg, subscriber)
    }

    /**
     * send MQTT UNSUBSCRIBE request to the broker with the given MQTTUnsubscribe parameter
     * The given topic filters are validated before send.
     * Returns a Promise that when resolved, indicates that the MQTT UNSUBSCRIBE operation is completed
     * and the resulting MQTTUnsubAck can be inspected to verify the status of the unsubscription.
     * @param msg MQTT protocol UNSUBSCRIBE parameter, @see MQTTUnsubscribe
     * @return Promise<MQTTUnsubAck> @see MQTTUnsubAck
     */
    unsubscribe(msg: MQTTUnsubscribe): Promise<MQTTUnsubAck> {
        return this.protocolHandler.sendUnsubscribe(msg)
    }

    getSubscriptionCache(): MQTTSubscribe[] {
        return this.protocolHandler.getSubscriptionCache()
    }
}

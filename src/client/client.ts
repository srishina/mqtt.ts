import {ProtocolHandler, Subscriber} from "./protocolhandler";
import {MQTTPublish} from "../message/publish";
import {MQTTSubAck, MQTTSubscribe} from "../message/subscribe";
import {MQTTUnsubAck, MQTTUnsubscribe} from "../message/unsubscribe";
import {MQTTConnAck} from "../message/connack";
import {MQTTConnect} from "../message/connect";

import {MessageEvents} from "./eventhandler";

import {EventEmitter} from "events";
import TypedEmitter from "typed-emitter";
import {MQTTDisconnectReason} from "../message/disconnect";
import {MQTTStatstics} from "../utils/constants";

/**
 * Creates a MQTT client by connecting to the specified MQTT broker
 * Returns a Promise that when resolved, indicates that the connection is successful
 * and MQTTClient object is returned.
 * @param url MQTT broker where the client should attempt a connection
 * @param msg MQTT protocol CONNECT parameter
 * @param timeout
 */
export function connect(url: string, msg: MQTTConnect, timeout: number): Promise<MQTTClient> {
    return MQTTClient.connect(url, msg, timeout);
}

/**
 * MQTT Client object
 */
export class MQTTClient extends (EventEmitter as new () => TypedEmitter<MessageEvents>) {
    private protocolHandler!: ProtocolHandler;
    private uri: string;

    constructor(uri: string) {
        super();
        this.uri = uri;
    }

    getURL(): string {
        return this.uri;
    }

    /** @internal */
    static connect(uri: string, msg: MQTTConnect, timeout: number): Promise<MQTTClient> {
        return new Promise((resolve, reject) => {
            const client = new MQTTClient(uri);
            ProtocolHandler.connect(uri, msg, timeout, client)
                .then((ph) => {
                    client.protocolHandler = ph;
                    resolve(client);
                }).catch((err) => {
                    reject(err);
                });
        });
    }

    getConnectResponse(): MQTTConnAck {
        return this.protocolHandler.getConnectResponse();
    }

    /**
     * Returns the client statistics, such as the number of bytes sent, received etc..
     * @see MQTTStatstics
     */
    getStatistics(): MQTTStatstics {
        return this.protocolHandler.getStatistics();
    }

    /**
     * send MQTT DISCONNECT packet and closes the connection with the to the MQTT broker.
     */
    disconnect(): void | never {
        this.protocolHandler.disconnect(MQTTDisconnectReason.Code.NormalDisconnection);
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
        return this.protocolHandler.sendPublish(msg);
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
        return this.protocolHandler.sendSubscribe(msg, subscriber);
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
        return this.protocolHandler.sendUnsubscribe(msg);
    }

    getSubscriptionCache(): MQTTSubscribe[] {
        return this.protocolHandler.getSubscriptionCache();
    }
}

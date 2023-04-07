import type { MQTTStatstics} from '../utils/constants'
import { PacketType } from '../utils/constants'
import { DataStreamDecoder, PIDGenerator, Deferred, encodedVarUint32Size } from '../utils/codec'
import type { Observer} from '../utils/topic'
import { TopicMatcher, isPublishTopicValid } from '../utils/topic'

// eslint-disable-next-line
let WebSocket: any;
if (typeof window === 'undefined') {
    WebSocket = require('ws')
} else {
    WebSocket = global.WebSocket
}

import { decodePublishPacket, MQTTPublishPacket } from '../message/publish'
import { decodePubAckPacket, MQTTPubAckPacket, MQTTPubAckReason } from '../message/puback'
import { decodePubRecPacket, MQTTPubRecPacket, MQTTPubRecReason } from '../message/pubrec'
import { decodePubRelPacket, MQTTPubRelPacket, MQTTPubRelReason } from '../message/pubrel'
import { decodePubCompPacket, MQTTPubCompPacket, MQTTPubCompReason } from '../message/pubcomp'
import type { MQTTSubAck, MQTTSubscribe} from '../message/subscribe'
import { decodeSubAckPacket, SubscribePacket } from '../message/subscribe'
import type { MQTTUnsubAck, MQTTUnsubscribe} from '../message/unsubscribe'
import { UnsubscribePacket, decodeUnsubAckPacket } from '../message/unsubscribe'
import type { MQTTDisconnect} from '../message/disconnect'
import { decodeDisconnectPacket, encodeDisconnectPacket, MQTTDisconnectReason } from '../message/disconnect'
import type { MQTTConnect} from '../message/connect'
import { encodeConnectPacket } from '../message/connect'
import type { MQTTConnAck } from '../message/connack'
import { decodeConnAckPacket } from '../message/connack'
import type { MQTTPublish } from '../message/publish'
import type { MessageEvents } from './eventhandler'
import type TypedEventEmitter from 'typed-emitter'
import { ServerDisconnectedError } from './errors'
import type { PacketWithID } from '../message/packet'
import { buildHeaderOnlyPacket } from '../message/packet'
import type { Options } from './options'

export type Subscriber = Observer<MQTTPublish>

class clientCompletionNotifier {
    public pkt: PacketWithID;
    public deferred: Deferred<MQTTSubAck | MQTTUnsubAck | void>;
    constructor(pkt: PacketWithID) {
        this.pkt = pkt
        this.deferred = new Deferred<MQTTSubAck | MQTTUnsubAck | void>()
    }

    onComplete(result: MQTTSubAck | MQTTUnsubAck | void): void {
        this.deferred.resolve(result)
    }

    onError(reason: Error): void {
        this.deferred.reject(reason)
    }
}

interface PingerCallback {
    sendPing(): void | never;
    internalDisconnect(e: Error): void | never;

}

class Pinger {
    private keepAliveInterval: number;
    private isReset: boolean;
    private timeout: ReturnType<typeof setTimeout>;
    private pingerCb: PingerCallback;
    constructor(keepAliveInterval: number, pingerCb: PingerCallback) {
        this.keepAliveInterval = keepAliveInterval * 1000
        this.isReset = false
        this.timeout = setTimeout(this.doTimeout, this.keepAliveInterval)
        clearTimeout(this.timeout)
        this.pingerCb = pingerCb
    }

    doTimeout(): void {
        if (!this.isReset) {
            // Disconnect the client, we didn't receive PINGRESP
            this.pingerCb.internalDisconnect(new Error('PINGRESP not received, disconnecting.'))

        } else {
            this.isReset = false
            this.pingerCb.sendPing()
            this.timeout = setTimeout(this.doTimeout.bind(this), this.keepAliveInterval)
        }
    }

    reset() {
        this.isReset = true
        clearTimeout(this.timeout)
        if (this.keepAliveInterval > 0) {
            this.timeout = setTimeout(this.doTimeout.bind(this), this.keepAliveInterval)
        }
    }

    cancel() {
        clearTimeout(this.timeout)
    }
}

class subscriptionCache extends Array<MQTTSubscribe> {
    removeSubscriptionFromCache(topicFilter: string): void {
        for (let i = this.length - 1; i >= 0; i--) {
            const index = this[i].subscriptions.findIndex(sub => sub.topicFilter === topicFilter)
            if (index != -1) {
                this[i].subscriptions.splice(index, 1)
            }
            if (this[i].subscriptions.length == 0) {
                this.splice(i, 1)
            }
        }
    }
}

export class ExponentialBackoff {
    private current: number;
    private maxValue: number;
    private jitter: number; // 0-1 inclusive

    constructor(initialDelay: number, maxValue: number, jitter: number) {
        this.current = initialDelay
        this.maxValue = maxValue
        this.jitter = jitter
    }

    next(): number {
        const range = (this.current - (this.current / 2)) * this.jitter
        this.current += (Math.random() * range) - range / 2

        this.current = Math.max(0, Math.min(this.maxValue, Math.floor(this.current)))

        const current = this.current

        // calculate the next value
        this.current *= 2
        return Math.floor(current)
    }
}

export class ProtocolHandler implements PingerCallback {
    private webSocket?: WebSocket;
    private uri: string;
    private options: Options;
    private remainingBuffer?: Uint8Array;
    private topicMatcher: TopicMatcher<MQTTPublish>;
    private pidgen: PIDGenerator;

    private connected: boolean;

    private connectingPromise?: Deferred<MQTTConnAck>;

    private clientCompletionNotifiers: Map<number, clientCompletionNotifier>;

    private outgoingRequests: Map<number, PacketWithID>;
    // topic filter and the subscribe request. used when the server does not support retaining of the
    // session. The cached subscriptions are resent.
    private subscriptionCache: subscriptionCache;

    private incommingPublish: Map<number, MQTTPublish>;

    private mqttConnAck?: MQTTConnAck;
    private eventEmitter: TypedEventEmitter<MessageEvents>;

    private pinger: Pinger;

    private autoReconnect: boolean;
    private connectParams?: MQTTConnect;
    private reconnecting: boolean;
    private clientTopicAliasMapping: Map<number, string>;

    private mqttStastics: MQTTStatstics;

    private sendQoS12Quota: number;
    private pendingQoS12Pkts: MQTTPublishPacket[];
    private pendingQoS0Pkts: MQTTPublishPacket[];

    private backoff: ExponentialBackoff;
    private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(uri: string, options: Options, emitter: TypedEventEmitter<MessageEvents>) {
        this.eventEmitter = emitter
        this.uri = uri
        this.options = options
        this.topicMatcher = new TopicMatcher<MQTTPublish>()
        this.outgoingRequests = new Map<number, MQTTPublishPacket>()
        this.incommingPublish = new Map<number, MQTTPublish>()
        this.clientCompletionNotifiers = new Map<number, clientCompletionNotifier>()
        this.clientTopicAliasMapping = new Map<number, string>()

        this.subscriptionCache = new subscriptionCache()

        this.pidgen = new PIDGenerator()

        this.connected = false
        this.pinger = new Pinger(0, this)
        this.autoReconnect = true
        this.reconnecting = true

        this.sendQoS12Quota = 65535
        this.pendingQoS12Pkts = [] // we store the QoS 1 & 2 packets when the server mandates the maximum QoS 1 & 2 packets that it can process
        this.pendingQoS0Pkts = [] // we store the QoS0 packets when we are not connected

        this.mqttStastics = { numBytesSent: 0, numBytesReceived: 0, totalPublishPktsSent: 0, totalPublishPktsReceived: 0 }

        this.backoff = new ExponentialBackoff(this.options.initialReconnectDelay, this.options.maxReconnectDelay, this.options.jitter)
    }

    connect(msg: MQTTConnect): Promise<MQTTConnAck> {
        return new Promise<MQTTConnAck>((resolve, reject) => {
            this.connectParams = msg
            this.doConnect(this.options.timeout)
                .then((result: MQTTConnAck) => {
                    resolve(result)
                }).catch((err) => {
                    reject(err)
                })
        })
    }

    getStatistics(): MQTTStatstics {
        return this.mqttStastics
    }

    getSubscriptionCache(): subscriptionCache {
        return this.subscriptionCache
    }

    disconnect(msg: MQTTDisconnect): void | never {
        this.sendDisconnect(msg)

        this.clearLocalState()
        this.trace('Disconnected error code: ' + msg.reasonCode + ' Desc: ' + MQTTDisconnectReason.Name.get(msg.reasonCode))
        this.eventEmitter.emit('disconnected', new Error('no error'))
    }

    sendDisconnect(msg: MQTTDisconnect): void | never {
        if (this.connected) {
            this.schedule(encodeDisconnectPacket(msg))
        }
    }

    clearLocalState(): void {
        if (this.webSocket) {
            if (this.webSocket.readyState == 1) {
                this.webSocket.close(1000)
            }
            this.webSocket.onopen = null
            this.webSocket.onmessage = null
            this.webSocket.onclose = null
            this.webSocket.onerror = null

            this.webSocket = undefined
        }
        this.pinger.cancel()
        delete this.remainingBuffer
        this.remainingBuffer = undefined
        this.connected = false
        this.pendingQoS12Pkts = []
        // cancel the reconenct timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
        }
    }

    internalDisconnect(e: Error): void | never {
        this.clearLocalState()
        this.eventEmitter.emit('disconnected', new Error('Connection lost'))
        const nextRetryInterval = this.backoff.next()
        // reconnect if needed
        this.reconnectTimer = setTimeout(() => {
            this.reconnect()
        }, nextRetryInterval)
        this.trace(`Connection failed with error ${e.message}, will retry after " + ${nextRetryInterval / 1000} + " secs`)
    }

    private reconnect(): void {
        if (!this.autoReconnect) {
            return
        }

        if (!this.connected) {
            this.eventEmitter.emit('reconnecting', 'Trying to reconnect...')
            this.reconnecting = true
            this.doConnect(this.options.timeout).then((result: MQTTConnAck) => {
                this.backoff = new ExponentialBackoff(this.options.initialReconnectDelay, this.options.maxReconnectDelay, this.options.jitter)
                this.reconnecting = false
                this.eventEmitter.emit('reconnected', result)
                this.mqttConnAck = result
                this.reconnectTimer = undefined
                this.drainPendingPkts()
            }).catch((error) => {
                this.backoff.next()
                this.internalDisconnect(error)
            })
        }
    }

    private doConnect(timeout: number): Promise<MQTTConnAck> {
        return new Promise((resolve, reject) => {
            this.webSocket = new WebSocket(this.uri, ['mqtt'])
            if (!this.webSocket) {
                reject(new Error('Error initialiting websocket object'))
                return
            }

            this.webSocket.binaryType = 'arraybuffer'

            this.webSocket.onclose = (event: CloseEvent) => {
                let e: Error
                if (event.code === 1000) {
                    e = new Error('Websocket closed normally')
                } else {
                    e = new Error('Websocket closed abnormally ' + event.code)
                    // reconnect
                    this.eventEmitter.emit('disconnected', e)
                }
                this.internalDisconnect(e)
            }

            this.webSocket.onerror = (error: Event) => {
                this.connectingPromise?.reject(error)
                this.connected = false
            }

            this.webSocket.onmessage = (evt: MessageEvent) => {
                this.messageReceived(evt.data)
            }

            this.webSocket.onopen = () => {
                this.protocolConnect()
            }

            this.connectingPromise = new Deferred<MQTTConnAck>()

            const timer = setTimeout(() => {
                this.disconnect({ reasonCode: MQTTDisconnectReason.Code.UnspecifiedError })
            }, timeout)

            this.connectingPromise?.getPromise()
                .then((connack: MQTTConnAck) => {
                    clearTimeout(timer)
                    resolve(connack)
                    this.connected = true
                    if (connack.properties && connack.properties.serverKeepAlive) {
                        this.pinger = new Pinger(connack.properties.serverKeepAlive, this)
                    }
                    else {
                        this.pinger = new Pinger(this.connectParams ? this.connectParams.keepAlive : 0, this)
                    }

                    if (connack.properties && connack.properties.receiveMaximum) {
                        this.sendQoS12Quota = connack.properties.receiveMaximum
                    }

                }).catch(
                    (err) => {
                        clearTimeout(timer)
                        reject(err)
                    }
                )
        })
    }

    private protocolConnect(): void | never {
        if (this.connectParams) {
            this.websocketSend(encodeConnectPacket(this.connectParams))
            return
        }
        throw new Error("CONNECT params is not set, can't connect")
    }

    private drainPendingPkts(): void | never {
        if (!this.mqttConnAck) {
            return
        }

        if (!this.mqttConnAck.sessionPresent) {
            this.outgoingRequests = new Map()
            // resubscribe
            this.resubscribe()

            // send all outgoing packets, that are not yet acknowledged.
            this.clientCompletionNotifiers.forEach((v, k) => {
                this.outgoingRequests.set(k, v.pkt)
            })
        }

        const outgoingRequestsCopy = new Map(this.outgoingRequests)
        // remap topic aliases
        const mappedAliases: Map<string, number> = new Map<string, number>()
        outgoingRequestsCopy.forEach((v) => {
            if (v instanceof MQTTPublishPacket) {
                const isPublish = v as MQTTPublishPacket
                if (isPublish.msg.properties && isPublish.msg.properties.topicAlias && isPublish.msg.topic.length == 0) {
                    const topic = this.clientTopicAliasMapping.get(isPublish.msg.properties.topicAlias)
                    if (topic && !mappedAliases.has(topic)) {
                        isPublish.msg.topic = topic
                        mappedAliases.set(topic, isPublish.msg.properties.topicAlias)
                    }
                }
                isPublish.msg.dup = true
                if (isPublish.msg.qos && (isPublish.msg.qos > 0)) {
                    this.scheduleQoS12Packet(isPublish)
                }
            } else {
                this.schedule(v.build())
            }
        })

        // Also schedule qos 0 buffered messages if any
        this.pendingQoS0Pkts.forEach((v) => {
            this.schedule(v.build())
        })
        this.pendingQoS0Pkts = []
    }

    private scheduleQoS0Packet(pkt: MQTTPublishPacket): void | never {
        if (this.connected) {
            this.websocketSend(pkt.build())
        }
        else {
            this.pendingQoS0Pkts.push(pkt)
        }
    }

    private decrementSendQuotaAndSend(pkt?: MQTTPublishPacket): void | never {
        if (this.connected) {
            if (pkt) {
                this.websocketSend(pkt.build())
            }
            else if (this.pendingQoS12Pkts.length > 0) {
                const pktToSend = this.pendingQoS12Pkts.pop()
                if (pktToSend) {
                    this.websocketSend(pktToSend.build())
                }
            } else {
                return
            }
            this.sendQoS12Quota--
        }

    }

    private incrementSendQuotaAndFlush(): void | never {
        this.sendQoS12Quota++
        this.decrementSendQuotaAndSend()
    }

    private scheduleQoS12Packet(pkt: MQTTPublishPacket): void | never {
        if (this.connected) {
            if (this.sendQoS12Quota > 0) {
                this.decrementSendQuotaAndSend(pkt)
            } else {
                this.pendingQoS12Pkts.unshift(pkt)
            }
        }
    }

    private schedule(buf: Uint8Array): void | never {
        if (this.connected) {
            this.websocketSend(buf)
        }
    }

    private websocketSend(buf: Uint8Array): void | never {
        if (!this.webSocket) {
            return
        }
        this.mqttStastics.numBytesSent += buf.byteLength
        this.webSocket.send(buf)
    }

    sendPing(): void | never {
        this.websocketSend(buildHeaderOnlyPacket(PacketType.PINGREQ))
        this.trace('send PINGREQ')
    }

    private completePublishMessage(id: number, error?: Error) {
        if (this.clientCompletionNotifiers.has(id)) {
            // we are completing a PUBLISH message with the QoS as 1 & 2
            this.incrementSendQuotaAndFlush()
            const completer = this.clientCompletionNotifiers.get(id)
            if (completer) {
                error ? completer.onError(error) : completer.onComplete()
            }
            this.clientCompletionNotifiers.delete(id)
        }
    }

    private completeSubscribeMessage(id: number, result: MQTTSubAck, error?: Error) {
        if (this.clientCompletionNotifiers.has(id)) {
            const completer = this.clientCompletionNotifiers.get(id)
            if (completer) {
                error ? completer.onError(error) : completer.onComplete(result)
            }
            this.clientCompletionNotifiers.delete(id)
        }
    }

    private completeUnsubscribeMessage(id: number, result: MQTTUnsubAck, error?: Error) {
        if (this.clientCompletionNotifiers.has(id)) {
            const completer = this.clientCompletionNotifiers.get(id)
            if (completer) {
                error ? completer.onError(error) : completer.onComplete(result)
            }
            this.clientCompletionNotifiers.delete(id)
        }
    }

    sendPublish(msg: MQTTPublish): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!isPublishTopicValid(msg.topic)) {
                throw new Error('Publish topic is invalid')
            }

            let topicAlias: number | undefined = undefined
            if (msg.properties && msg.properties.topicAlias) {
                topicAlias = msg.properties.topicAlias
            }

            if (!topicAlias && msg.topic.length == 0) {
                throw new Error('Publish topic is invalid')
            }

            // check if topic alias has been set
            if (topicAlias && msg.topic.length > 0) {
                this.clientTopicAliasMapping.set(topicAlias, msg.topic)
            }

            // delete topic alias if the client has reset
            if (msg.topic.length > 0 && !topicAlias) {
                for (const [key, value] of this.clientTopicAliasMapping) {
                    if (value === msg.topic) {
                        this.clientTopicAliasMapping.delete(key)
                        return
                    }
                }
            }

            const packetID = (msg.qos && (msg.qos > 0)) ? this.pidgen.nextID() : 0

            const publishPkt = new MQTTPublishPacket(packetID, msg)
            const publishMsg = new clientCompletionNotifier(publishPkt)
            if (msg.qos && (msg.qos > 0)) {
                this.outgoingRequests.set(packetID, publishPkt)
                this.clientCompletionNotifiers.set(packetID, publishMsg)
                this.scheduleQoS12Packet(publishPkt)
            } else {
                this.scheduleQoS0Packet(publishPkt)
                // We complete the message when qos is 0
                publishMsg.onComplete()
            }

            publishMsg.deferred.getPromise()
                .then(
                    () => {
                        resolve()
                        this.mqttStastics.totalPublishPktsSent++
                    })
                .catch((err) => {
                    reject(err)
                }
                )
        })
    }

    sendSubscribe(msg: MQTTSubscribe, subscriber: Subscriber): Promise<MQTTSubAck> {
        return new Promise<MQTTSubAck>((resolve, reject) => {
            msg.subscriptions.forEach((el) => {
                this.topicMatcher.subscribe(el.topicFilter, subscriber)
            })

            const packetID = this.pidgen.nextID()
            const subscribePkt = new SubscribePacket(packetID, msg)
            this.outgoingRequests.set(packetID, subscribePkt)
            const subscribeMsg = new clientCompletionNotifier(subscribePkt)
            this.clientCompletionNotifiers.set(packetID, subscribeMsg)
            this.schedule(subscribePkt.build())
            subscribeMsg.deferred.getPromise()
                .then(
                    (value: MQTTSubAck | MQTTUnsubAck | void) => {
                        resolve(value as MQTTSubAck)
                        // store the subscribe packets
                        this.subscriptionCache.push(msg)
                    })
                .catch((err) => {
                    reject(err)
                }
                )
        })
    }

    private resubscribe(): void | never {
        this.subscriptionCache.forEach((el) => {
            const packetID = this.pidgen.nextID()
            const subscribePkt = new SubscribePacket(packetID, el)
            const subscribeMsg = new clientCompletionNotifier(subscribePkt)
            this.clientCompletionNotifiers.set(packetID, subscribeMsg)
            this.schedule(subscribePkt.build())
            // todo impl, timeout
            subscribeMsg.deferred.getPromise()
                .then((value: MQTTSubAck | MQTTUnsubAck | void) => {
                    // we are resubscribed, inform the client todo... emit resubscribe
                    // store the subscribe packets
                    this.subscriptionCache.push(el)
                    this.eventEmitter.emit('resubscription', el, { suback: value as MQTTSubAck })
                })
                .catch((err: Error) => {
                    // resubscribe failed, inform the client
                    this.eventEmitter.emit('resubscription', el, { err: err })
                })
        })
        this.subscriptionCache = new subscriptionCache()
    }

    sendUnsubscribe(msg: MQTTUnsubscribe): Promise<MQTTUnsubAck> {
        return new Promise<MQTTUnsubAck>((resolve, reject) => {
            msg.topicFilters.forEach((el) => {
                this.topicMatcher.unsubscribe(el)
                this.subscriptionCache.removeSubscriptionFromCache(el)
            })

            const packetID = this.pidgen.nextID()
            const unsubscribePkt = new UnsubscribePacket(packetID, msg)
            this.outgoingRequests.set(packetID, unsubscribePkt)
            const unsubscribeMsg = new clientCompletionNotifier(unsubscribePkt)
            this.clientCompletionNotifiers.set(packetID, unsubscribeMsg)
            this.schedule(unsubscribePkt.build())
            unsubscribeMsg.deferred.getPromise()
                .then(
                    (value: MQTTSubAck | MQTTUnsubAck | void) => {
                        resolve(value as MQTTUnsubAck)
                    })
                .catch((err) => {
                    reject(err)
                }
                )
        })
    }

    private notifyPublishMessage(msg: MQTTPublish) {
        this.mqttStastics.totalPublishPktsReceived++
        const subscribers = this.topicMatcher.match(msg.topic)
        subscribers.forEach(element => {
            element.onData(msg)
        })
    }

    private publishReceived(pktID: number, msg: MQTTPublish) {
        switch (msg.qos) {
            case 0:
                this.notifyPublishMessage(msg)
                break
            case 1: {
                const pubAckPkt = new MQTTPubAckPacket(pktID, { reason: MQTTPubAckReason.Code.Success })
                this.schedule(pubAckPkt.build())
                if (!msg.dup) {
                    this.notifyPublishMessage(msg)
                }
                break
            }
            case 2: {
                this.incommingPublish.set(pktID, msg)
                // construct PUBREC packet
                const pubRecPkt = new MQTTPubRecPacket(pktID, { reason: MQTTPubRecReason.Code.Success })
                this.schedule(pubRecPkt.build())
                break
            }
        }
    }

    private decodeMessage(byte0: number, decoder: DataStreamDecoder): void | never {
        const ptype = byte0 >> 4
        switch (ptype) {
            case PacketType.CONNACK: {
                const connAck = decodeConnAckPacket(decoder)
                if (this.connectingPromise) {
                    this.connectingPromise.resolve(connAck)
                }
                break
            }

            case PacketType.PUBLISH: {
                const { pktID, result } = decodePublishPacket(byte0, decoder)
                this.publishReceived(pktID, result)
                break
            }

            case PacketType.PUBACK: {
                const { pktID } = decodePubAckPacket(byte0, decoder)
                this.completePublishMessage(pktID)
                this.outgoingRequests.delete(pktID)
                this.pidgen.freeID(pktID)
                break
            }

            case PacketType.PUBREC: {
                const { pktID } = decodePubRecPacket(byte0, decoder)
                // build PUBREL request
                const pubRelPkt = new MQTTPubRelPacket(pktID, { reason: MQTTPubRelReason.Code.Success })
                this.outgoingRequests.set(pktID, pubRelPkt)
                this.schedule(pubRelPkt.build())
                break
            }

            case PacketType.PUBREL: {
                const { pktID } = decodePubRelPacket(byte0, decoder)
                this.outgoingRequests.delete(pktID)
                // build PUBCOMP request
                const pubCompPkt = new MQTTPubCompPacket(pktID, { reason: MQTTPubCompReason.Code.Success })
                this.schedule(pubCompPkt.build())
                // notify the incomming publish
                if (this.incommingPublish.has(pktID)) {
                    const msg = this.incommingPublish.get(pktID)
                    if (msg) {
                        this.notifyPublishMessage(msg)
                        this.incommingPublish.delete(pktID)
                    }
                }
                break
            }

            case PacketType.PUBCOMP: {
                const { pktID } = decodePubCompPacket(byte0, decoder)
                this.outgoingRequests.delete(pktID)
                this.completePublishMessage(pktID)
                this.pidgen.freeID(pktID)
                break
            }

            case PacketType.SUBACK: {
                const { pktID, result } = decodeSubAckPacket(decoder)
                this.completeSubscribeMessage(pktID, result)
                this.outgoingRequests.delete(pktID)
                this.pidgen.freeID(pktID)
                break
            }

            case PacketType.UNSUBACK: {
                const { pktID, result } = decodeUnsubAckPacket(decoder)
                // return the payload
                this.completeUnsubscribeMessage(pktID, result)
                this.outgoingRequests.delete(pktID)
                this.pidgen.freeID(pktID)
                break
            }

            case PacketType.DISCONNECT: {
                const mqttDisconnect = decodeDisconnectPacket(decoder)
                throw new ServerDisconnectedError(new MQTTDisconnectReason(mqttDisconnect.reasonCode))
            }

            case PacketType.PINGRESP: {
                // PING response received
                this.pinger.reset()
                this.trace('received PINGRESP')
                break
            }

            default: {
                throw new Error('invalid packet received...')
            }
        }
    }

    private messageReceived(arrayBuffer: ArrayBuffer): void | never {
        this.mqttStastics.numBytesReceived += arrayBuffer.byteLength
        try {
            let dataToDecode = arrayBuffer
            if (this.remainingBuffer) {
                const newData = new Uint8Array(this.remainingBuffer.length + arrayBuffer.byteLength)
                newData.set(this.remainingBuffer)
                newData.set(new Uint8Array(arrayBuffer), this.remainingBuffer.length)
                dataToDecode = newData.buffer
                delete this.remainingBuffer
            }

            const decoder = new DataStreamDecoder(dataToDecode)
            while (decoder.remainingLength() > 0) {
                const decoderToUse = decoder.clone()
                const byte0 = decoderToUse.decodeByte()
                const remainingLen = decoderToUse.tryDecodeVarUint32()
                // we could not read the remaining length or the full packet is not yet available
                if ((remainingLen == -1) || (decoderToUse.remainingLength() < remainingLen)) {
                    // insufficient buffer, store the remaining buffer
                    this.remainingBuffer = decoder.remainigBuffer()
                    return
                }
                decoder.skipBytes(1 + encodedVarUint32Size(remainingLen) + remainingLen)

                // Mark the decoder read boundary
                decoderToUse.markBoundary(remainingLen)
                this.decodeMessage(byte0, decoderToUse)
            }
        }
        catch (e: unknown) {
            if (!(e instanceof Error)) {
                return
            }

            this.eventEmitter.emit('disconnected', e)
            if (e instanceof ServerDisconnectedError) {
                // Server sent DISCONNECT packet
                this.trace(e.getMessageWithDescription())
            } else {
                this.trace(e.message)
                // pass the error code
                this.sendDisconnect({ reasonCode: MQTTDisconnectReason.Code.ProtocolError })
            }
            this.internalDisconnect(e)
        }
    }

    private trace(msg: string): void {
        this.eventEmitter.emit('logs', { epochTSInMS: new Date().getTime(), message: msg })
    }
}

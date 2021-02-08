import {DataStreamDecoder, encodedVarUint32Size} from "../utils/codec";
import WebSocket = require('ws');
import {PacketType} from '../utils/constants';
import {decodeConnectPacket} from "../message/connect";
import {encodeConnAckPacket, MQTTConnAck} from "../message/connack";
import {decodeSubscribePacket, MQTTSubAck, SubAckPacket} from "../message/subscribe";
import {decodeUnsubAckPacket, MQTTUnsubAck, UnsubAckPacket} from "../message/unsubscribe";
import {decodePublishPacket, MQTTPublish, PublishPacket} from "../message/publish";
import {MQTTPubAck, MQTTPubAckPacket, decodePubAckPacket} from "../message/puback";
import {MQTTPubRec, MQTTPubRecPacket, decodePubRecPacket} from "../message/pubrec";
import {MQTTPubComp, MQTTPubCompPacket, decodePubCompPacket} from "../message/pubcomp";
import {decodePubRelPacket, MQTTPubRel, MQTTPubRelPacket} from "../message/pubrel";

export class testMockServer {
    private port = 3000;
    private server: WebSocket.Server
    private remainingBuffer?: Uint8Array;
    private connAckPacket: MQTTConnAck;
    private responses?: Map<PacketType, MQTTSubAck | MQTTUnsubAck | MQTTPublish | MQTTPubAck | MQTTPubRec | MQTTPubRel | MQTTPubComp>;
    private conn?: WebSocket;
    private triggerPublishOnsubscribe: boolean;
    private publishAckd: boolean;
    private disconnectAtPktCount: number
    private numRecvdPkts: number;

    constructor(connack: MQTTConnAck, disconnectAtPktCount?: number) {
        this.server = new WebSocket.Server({port: this.port});
        this.connAckPacket = connack;
        this.triggerPublishOnsubscribe = false;
        this.publishAckd = false;
        this.numRecvdPkts = 0;
        this.disconnectAtPktCount = disconnectAtPktCount ? disconnectAtPktCount : 0;
    }

    setResponses(responses: Map<PacketType, MQTTSubAck | MQTTUnsubAck | MQTTPublish | MQTTPubAck | MQTTPubRec | MQTTPubRel | MQTTPubComp>) {
        this.responses = responses;
    }

    setTriggerPublishOnSubscribe() {
        this.triggerPublishOnsubscribe = true;
    }

    isPublishAckd(): boolean {
        return this.publishAckd;
    }

    start() {
        this.server.on('connection', conn => {
            this.conn = conn;
            conn.on('message', (data: WebSocket.Data) => {
                this.handler(data);
            });
        });
    }

    closeClientConnection(): void {
        this.conn!.close();
    }

    stop() {
        this.server.close();
    }

    handler(data: WebSocket.Data): void | never {
        const b = data as Buffer;
        if (b) {
            let dataToDecode: ArrayBuffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
            if (this.remainingBuffer) {
                const newData = new Uint8Array(this.remainingBuffer.length + dataToDecode.byteLength);
                newData.set(this.remainingBuffer);
                newData.set(new Uint8Array(dataToDecode), this.remainingBuffer.length);
                dataToDecode = newData.buffer;
                delete this.remainingBuffer;
            }
            const decoder = new DataStreamDecoder(dataToDecode);
            while (decoder.remainingLength() > 0) {
                const decoderToUse = decoder.clone();
                const byte0 = decoderToUse.decodeByte();
                const remainingLen = decoderToUse.tryDecodeVarUint32();
                // we could not read the remaining length or the full packet is not yet available
                if ((remainingLen == -1) || (decoderToUse.remainingLength() < remainingLen)) {
                    // insufficient buffer, store the remaining buffer
                    this.remainingBuffer = decoder.remainigBuffer();
                    return;
                }
                decoder.skipBytes(1 + encodedVarUint32Size(remainingLen) + remainingLen);

                // Mark the decoder read boundary
                decoderToUse.markBoundary(remainingLen);
                this.numRecvdPkts++;
                if (this.disconnectAtPktCount != 0 && this.numRecvdPkts == this.disconnectAtPktCount) {
                    this.closeClientConnection();
                    this.numRecvdPkts = 0;
                    return;
                }
                this.handleMessage(byte0, decoderToUse);
            }
        }
    }

    handleMessage(byte0: number, dec: DataStreamDecoder): void | never {
        switch (byte0 >> 4) {
            case PacketType.CONNECT: {
                const mqttConnect = decodeConnectPacket(dec);
                this.conn!.send(encodeConnAckPacket(this.connAckPacket));
                break;
            }
            case PacketType.DISCONNECT:
                this.conn!.close();
                this.conn = undefined;
                break;
            case PacketType.SUBSCRIBE: {
                const mqttSubscribe = decodeSubscribePacket(dec);
                const suback = this.responses!.get(PacketType.SUBACK);
                if (suback) {
                    const subackPkt = new SubAckPacket(mqttSubscribe.pktID, suback as MQTTSubAck);
                    this.conn!.send(subackPkt.build());
                } else {
                    throw new Error("MOCK server - internal error");
                }
                if (this.triggerPublishOnsubscribe) {
                    setTimeout(() => {
                        this.triggerPublish();
                    }, 0);
                }
                break;
            }
            case PacketType.UNSUBSCRIBE: {
                const mqttUnsubscribe = decodeUnsubAckPacket(dec);
                const unsuback = this.responses!.get(PacketType.UNSUBACK);
                if (unsuback) {
                    const unsubackPkt = new UnsubAckPacket(mqttUnsubscribe.pktID, unsuback as MQTTUnsubAck);
                    this.conn!.send(unsubackPkt.build());
                } else {
                    throw new Error("MOCK server - internal error");
                }
                break;
            }
            case PacketType.PUBLISH: {
                const {pktID, result} = decodePublishPacket(byte0, dec);
                switch (result.qos) {
                    case 1: {
                        const puback = this.responses!.get(PacketType.PUBACK);
                        if (puback) {
                            const pubackPkt = new MQTTPubAckPacket(pktID, puback as MQTTPubAck);
                            this.conn!.send(pubackPkt.build());
                        } else {
                            throw new Error("MOCK server - internal error");
                        }
                        break;
                    }
                    case 2: {
                        const pubrec = this.responses!.get(PacketType.PUBREC);
                        if (pubrec) {
                            const pubrecPkt = new MQTTPubRecPacket(pktID, pubrec as MQTTPubRec);
                            this.conn!.send(pubrecPkt.build());
                        } else {
                            throw new Error("MOCK server - internal error");
                        }
                        break;
                    }
                }
                break;
            }

            case PacketType.PUBACK: {
                const {pktID} = decodePubAckPacket(byte0, dec);
                if (pktID == 0) {
                    throw new Error("MOCK server - internal error, invalid pkt id received for PUBACK");
                }
                this.publishAckd = true;
                break;
            }

            case PacketType.PUBREC: {
                const {pktID} = decodePubRecPacket(byte0, dec);
                const pubrel = this.responses!.get(PacketType.PUBREL);
                if (pubrel) {
                    const pubrelPkt = new MQTTPubRelPacket(pktID, pubrel as MQTTPubRel);
                    this.conn!.send(pubrelPkt.build());
                } else {
                    throw new Error("MOCK server - internal error");
                }
                break;
            }

            case PacketType.PUBREL: {
                const {pktID} = decodePubRelPacket(byte0, dec);
                const pubcomp = this.responses!.get(PacketType.PUBCOMP);
                if (pubcomp) {
                    const pubcompPkt = new MQTTPubCompPacket(pktID, pubcomp as MQTTPubComp);
                    this.conn!.send(pubcompPkt.build());
                } else {
                    throw new Error("MOCK server - internal error");
                }
                break;
            }

            case PacketType.PUBCOMP: {
                const {pktID} = decodePubCompPacket(byte0, dec);
                if (pktID == 0) {
                    throw new Error("MOCK server - internal error, invalid pkt id received for PUBCOMP");
                }
                this.publishAckd = true;
                break;
            }

            default:
                throw new Error("MOCK server - internal error");
        }
    }

    triggerPublish(): void {
        const publish = this.responses!.get(PacketType.PUBLISH);
        if (publish) {
            const pktID = Math.floor(Math.random() * 100) + 1;
            const publishPkt = new PublishPacket(pktID, publish as MQTTPublish);
            this.conn!.send(publishPkt.build());
        }
    }
}

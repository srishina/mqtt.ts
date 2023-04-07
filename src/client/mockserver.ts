import { DataStreamDecoder, encodedVarUint32Size } from "../utils/codec";
import * as WebSocket from 'ws';
import { PacketType } from '../utils/constants';
import { encodeConnAckPacket, MQTTConnAck } from "../message/connack";
import { decodeSubscribePacket, MQTTSubAck, SubAckPacket } from "../message/subscribe";
import { decodeUnsubAckPacket, MQTTUnsubAck, UnsubAckPacket } from "../message/unsubscribe";
import { decodePublishPacket, MQTTPublish, MQTTPublishPacket } from "../message/publish";
import { MQTTPubAck, MQTTPubAckPacket, decodePubAckPacket } from "../message/puback";
import { MQTTPubRec, MQTTPubRecPacket, decodePubRecPacket } from "../message/pubrec";
import { MQTTPubComp, MQTTPubCompPacket, decodePubCompPacket } from "../message/pubcomp";
import { decodePubRelPacket, MQTTPubRel, MQTTPubRelPacket } from "../message/pubrel";
import { PacketWithID } from "../message/packet";

export class testMockServer {
    private port = 3000;
    private server: WebSocket.Server
    private remainingBuffer?: Uint8Array;
    private connAckPacket: MQTTConnAck;
    private responses: Map<PacketType, MQTTSubAck | MQTTUnsubAck | MQTTPublish | MQTTPubAck | MQTTPubRec | MQTTPubRel | MQTTPubComp> = new Map();
    private conn?: WebSocket;
    private triggerPublishOnsubscribe: boolean;
    private publishAckd: boolean;
    private disconnectAtPktCount: number
    private numRecvdPkts: number;

    constructor(connack: MQTTConnAck, disconnectAtPktCount?: number) {
        this.server = new WebSocket.Server({ port: this.port });
        this.connAckPacket = connack;
        this.triggerPublishOnsubscribe = false;
        this.publishAckd = false;
        this.numRecvdPkts = 0;
        this.disconnectAtPktCount = disconnectAtPktCount ? disconnectAtPktCount : 0;
    }

    setResponses(responses: Map<PacketType, MQTTSubAck | MQTTUnsubAck | MQTTPublish | MQTTPubAck | MQTTPubRec | MQTTPubRel | MQTTPubComp>): void {
        this.responses = responses;
    }

    setTriggerPublishOnSubscribe(): void {
        this.triggerPublishOnsubscribe = true;
    }

    isPublishAckd(): boolean {
        return this.publishAckd;
    }

    start(): void {
        this.server.on('connection', conn => {
            this.conn = conn;
            conn.on('message', (data: WebSocket.Data) => {
                this.handler(data);
            });
        });
    }

    closeClientConnection(): void {
        if (this.conn) {
            this.conn.close();
        }
    }

    stop(): void {
        this.server.close();
    }

    sendResponse<T extends PacketWithID, MQTTP extends unknown>(pktID: number, pktType: PacketType, objectType: { new(pktID: number, mqttObj: MQTTP): T; }): void {
        const resp = this.responses.get(pktType);
        if (resp && this.conn) {
            const respPkt = new objectType(pktID, resp as MQTTP);
            this.conn.send(respPkt.build());
        } else {
            throw new Error("MOCK server - internal error");
        }
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
                if (this.conn) {
                    this.conn.send(encodeConnAckPacket(this.connAckPacket));
                }
                break;
            }
            case PacketType.DISCONNECT:
                if (this.conn) {
                    this.conn.close();
                }
                this.conn = undefined;
                break;
            case PacketType.SUBSCRIBE: {
                const mqttSubscribe = decodeSubscribePacket(dec);
                this.sendResponse<SubAckPacket, MQTTSubAck>(mqttSubscribe.pktID, PacketType.SUBACK, SubAckPacket);
                if (this.triggerPublishOnsubscribe) {
                    setTimeout(() => {
                        this.triggerPublish();
                    }, 0);
                }
                break;
            }
            case PacketType.UNSUBSCRIBE: {
                const mqttUnsubscribe = decodeUnsubAckPacket(dec);
                this.sendResponse<UnsubAckPacket, MQTTUnsubAck>(mqttUnsubscribe.pktID, PacketType.UNSUBACK, UnsubAckPacket);
                break;
            }
            case PacketType.PUBLISH: {
                const { pktID, result } = decodePublishPacket(byte0, dec);
                switch (result.qos) {
                    case 1: {
                        this.sendResponse<MQTTPubAckPacket, MQTTPubAck>(pktID, PacketType.PUBACK, MQTTPubAckPacket);
                        break;
                    }
                    case 2: {
                        this.sendResponse<MQTTPubRecPacket, MQTTPubRec>(pktID, PacketType.PUBREC, MQTTPubRecPacket);
                        break;
                    }
                }
                break;
            }

            case PacketType.PUBACK: {
                const { pktID } = decodePubAckPacket(byte0, dec);
                if (pktID == 0) {
                    throw new Error("MOCK server - internal error, invalid pkt id received for PUBACK");
                }
                this.publishAckd = true;
                break;
            }

            case PacketType.PUBREC: {
                const { pktID } = decodePubRecPacket(byte0, dec);
                this.sendResponse<MQTTPubRelPacket, MQTTPubRel>(pktID, PacketType.PUBREL, MQTTPubRelPacket);
                break;
            }

            case PacketType.PUBREL: {
                const { pktID } = decodePubRelPacket(byte0, dec);
                this.sendResponse<MQTTPubCompPacket, MQTTPubComp>(pktID, PacketType.PUBCOMP, MQTTPubCompPacket);
                break;
            }

            case PacketType.PUBCOMP: {
                const { pktID } = decodePubCompPacket(byte0, dec);
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
        const pktID = Math.floor(Math.random() * 100) + 1;
        this.sendResponse<MQTTPublishPacket, MQTTPublish>(pktID, PacketType.PUBLISH, MQTTPublishPacket);
    }
}

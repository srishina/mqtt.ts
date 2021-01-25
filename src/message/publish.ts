import {PacketWithID} from "./packet";
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, encodedVarUint32Size, DataStreamDecoder, PropertyDecoderOnlyOnce} from "../utils/codec";
import {getPropertyText, PacketType, PropertyID} from '../utils/constants';
import {DecoderError} from "../client/errors";

export function getPayloadAsArray(payload: Uint8Array | string): Uint8Array {
    if (typeof payload === "string") {
        const utf8Enc = new TextEncoder();
        return utf8Enc.encode(payload);
    }
    return payload as Uint8Array;
}

export function getPayloadAsString(payload: Uint8Array | string): string {
    if (typeof payload === "string") {
        return payload;
    }
    const utf8Dec = new TextDecoder();
    return utf8Dec.decode(payload);
}

export type MQTTPublish = {
    topic: string;
    qos?: number;
    retain?: boolean;
    dup?: boolean;
    payload: Uint8Array | string;

    payloadFormatIndicator?: number;
    messageExpiryInterval?: number;
    topicAlias?: number;
    contentType?: string;
    responseTopic?: string;
    correlationData?: Uint8Array;
    userProperty?: Map<string, string>;
    subscriptionIdentifiers?: number[];
};

export class PublishPacket extends PacketWithID {
    public msg: MQTTPublish;

    constructor(id: number, msg: MQTTPublish) {
        super(id);
        this.msg = msg;
    }

    propertyLength(): number {
        let propertyLen = 0;
        propertyLen += PropertySizeIfNotEmpty.fromByte(this.msg.payloadFormatIndicator);
        propertyLen += PropertySizeIfNotEmpty.fromUint32(this.msg.messageExpiryInterval);
        propertyLen += PropertySizeIfNotEmpty.fromUint16(this.msg.topicAlias);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(this.msg.contentType);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(this.msg.responseTopic);
        propertyLen += PropertySizeIfNotEmpty.fromBinaryData(this.msg.correlationData);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(this.msg.userProperty);
        propertyLen += PropertySizeIfNotEmpty.fromVarUint32Array(this.msg.subscriptionIdentifiers);

        return propertyLen;
    }

    encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen);
        PropertyEncoderIfNotEmpty.fromByte(enc, PropertyID.PayloadFormatIndicatorID, this.msg.payloadFormatIndicator);
        PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.MessageExpiryIntervalID, this.msg.messageExpiryInterval);
        PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.TopicAliasID, this.msg.topicAlias);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ContentTypeID, this.msg.contentType);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ResponseTopicID, this.msg.responseTopic);
        PropertyEncoderIfNotEmpty.fromBinaryData(enc, PropertyID.CorrelationDataID, this.msg.correlationData);
        PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, this.msg.userProperty);
        PropertyEncoderIfNotEmpty.fromVarUint32Array(enc, PropertyID.SubscriptionIdentifierID, this.msg.subscriptionIdentifiers);
    }

    build(): Uint8Array | never {
        const propertyLen = this.propertyLength();

        let remainingLength = (2 + this.msg.topic.length + propertyLen + encodedVarUint32Size(propertyLen));

        if (this.msg.qos && (this.msg.qos > 0)) {
            remainingLength += 2;
        }
        const payloadArray = getPayloadAsArray(this.msg.payload);
        remainingLength += payloadArray.length;

        let headerFlag = (PacketType.PUBLISH << 4);
        if (this.msg.dup) {
            headerFlag |= 0x08;
        }
        headerFlag |= ((this.msg.qos ? this.msg.qos : 0) << 1);

        if (this.msg.retain) {
            headerFlag |= 0x01;
        }

        const encoder = new DataStreamEncoder(remainingLength + 2); // fixed header length = 1,  remaining len(varuint32)
        encoder.encodeByte(headerFlag);
        encoder.encodeVarUint32(remainingLength);

        encoder.encodeUTF8String(this.msg.topic);

        if (this.msg.qos && (this.msg.qos > 0)) {
            encoder.encodeUint16(this.id);
        }

        // encode properties
        this.encodeProperties(encoder, propertyLen);

        // write payload
        encoder.encodeBinaryDataNoLength(payloadArray);
        return encoder.byteArray;
    }
}

export function decodePublishPacket(byte0: number, dec: DataStreamDecoder): {pktID: number, result: MQTTPublish} {
    const data: MQTTPublish = {topic: '', payload: new Uint8Array()};

    data.qos = (byte0 >> 1) & 0x03;
    data.dup = (byte0 & 0x08) > 0;
    data.retain = (byte0 & 0x01) > 0;

    // Decode UTF8 string
    data.topic = dec.decodeUTF8String();
    let pktID = 0;
    if (data.qos > 0) {
        pktID = dec.decodeUint16();
    }

    // read properties
    let propertyLen = dec.decodeVarUint32();
    while (propertyLen > 0) {
        const id = dec.decodeVarUint32();
        propertyLen--;
        switch (id) {
            case PropertyID.PayloadFormatIndicatorID: {
                data.payloadFormatIndicator = PropertyDecoderOnlyOnce.toByte(dec, id, data.payloadFormatIndicator);
                propertyLen--;
                break;
            }

            case PropertyID.MessageExpiryIntervalID: {
                data.messageExpiryInterval = PropertyDecoderOnlyOnce.toUint32(dec, id, data.messageExpiryInterval);
                propertyLen -= 4;
                break;
            }

            case PropertyID.TopicAliasID: {
                data.topicAlias = PropertyDecoderOnlyOnce.toUint16(dec, id, data.topicAlias);
                propertyLen -= 2;
                break;
            }

            case PropertyID.ResponseTopicID: {
                data.responseTopic = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.responseTopic);
                propertyLen -= (data.responseTopic.length + 2);
                break;
            }

            case PropertyID.CorrelationDataID: {
                data.correlationData = PropertyDecoderOnlyOnce.toBinaryData(dec, id, data.correlationData);
                propertyLen -= (data.correlationData.length + 2);
                break;
            }

            case PropertyID.UserPropertyID: {
                if (!data.userProperty) {
                    data.userProperty = new Map<string, string>();
                }
                const {key, value} = dec.decodeUTF8StringPair();
                data.userProperty.set(key, value);
                propertyLen -= (key.length + value.length + 4);
                break;
            }

            case PropertyID.SubscriptionIdentifierID: {
                if (!data.subscriptionIdentifiers) {
                    data.subscriptionIdentifiers = [];
                }
                const v = dec.decodeVarUint32();
                if (v == 0) {
                    throw new Error(getPropertyText(id) + " must not be 0");
                }

                data.subscriptionIdentifiers.push(v);
                propertyLen -= encodedVarUint32Size(v);
                break;
            }

            case PropertyID.ContentTypeID: {
                data.contentType = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.contentType);
                propertyLen -= (data.contentType.length + 2);
                break;
            }

            default:
                throw new DecoderError("PUBLISH: wrong property with identifier " + id);
        }
    }

    data.payload = dec.decodeBinaryDataNoLength(dec.remainingLength());

    return {pktID: pktID, result: data};
}

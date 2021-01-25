import {PacketWithID} from "./packet";
import {PacketType, PropertyID, MQTTCommonReasonCode, getPropertyText, getCommonReasonCodeName} from '../utils/constants';
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, encodedVarUint32Size, DataStreamDecoder, PropertyDecoderOnlyOnce} from "../utils/codec";
import {DecoderError} from "../client/errors";

export type MQTTSubscription = {
    topicFilter: string;
    qos?: number;
    noLocal?: boolean;
    retainAsPublished?: boolean;
    retainHandling?: number;
}

export type MQTTSubscribe = {
    subscriptions: MQTTSubscription[];
    subscriptionIdentifer?: number;
    userProperty?: Map<string, string>;
};

export class SubscribePacket extends PacketWithID {
    private msg: MQTTSubscribe;

    constructor(pktID: number, msg: MQTTSubscribe) {
        super(pktID);
        this.msg = msg;
    }

    propertyLength(): number {
        let propertyLen = 0;
        propertyLen += PropertySizeIfNotEmpty.fromVarUin32(this.msg.subscriptionIdentifer);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(this.msg.userProperty);

        return propertyLen;
    }

    encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen);
        PropertyEncoderIfNotEmpty.fromVarUint32(enc, PropertyID.SubscriptionIdentifierID, this.msg.subscriptionIdentifer);
        PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, this.msg.userProperty);
    }

    build(): Uint8Array | never {
        const propertyLen = this.propertyLength();

        let remainingLength = (2 + propertyLen + encodedVarUint32Size(propertyLen));
        this.msg.subscriptions.forEach(function (el) {
            remainingLength += (2 + el.topicFilter.length + 1);
        });

        const encoder = new DataStreamEncoder(remainingLength + 2); // fixed header length = 1,  remaining len(varuint32)

        encoder.encodeByte((PacketType.SUBSCRIBE << 4) | 0x2);
        encoder.encodeVarUint32(remainingLength);

        encoder.encodeUint16(this.id);

        // encode properties
        this.encodeProperties(encoder, propertyLen);

        this.msg.subscriptions.forEach(function (el) {
            encoder.encodeUTF8String(el.topicFilter);

            let b = 0;
            // write subscribe options
            b |= ((el.qos ? el.qos : 0) & 0x03);
            if (el.noLocal) {
                b |= 0x04;
            }
            if (el.retainAsPublished) {
                b |= 0x08;
            }

            b |= ((el.retainHandling ? el.retainHandling : 0) & 0x30);

            encoder.encodeByte(b);
        });

        return encoder.byteArray;
    }
}

export function decodeSubscribePacket(dec: DataStreamDecoder): {pktID: number, result: MQTTSubscribe} | never {
    const pktID = dec.decodeUint16();

    const result: MQTTSubscribe = {subscriptions: []};
    // decode properties
    let propertyLen = dec.decodeVarUint32();
    while (propertyLen > 0) {
        const id = dec.decodeVarUint32();
        propertyLen--;
        switch (id) {
            case PropertyID.SubscriptionIdentifierID:
                result.subscriptionIdentifer = PropertyDecoderOnlyOnce.toVarUint32(dec, id, result.subscriptionIdentifer);
                if (result.subscriptionIdentifer == 0) {
                    throw new Error(getPropertyText(id) + " must not be 0");
                }
                propertyLen -= encodedVarUint32Size(result.subscriptionIdentifer);
                break;
            case PropertyID.UserPropertyID: {
                if (!result.userProperty) {
                    result.userProperty = new Map<string, string>();
                }
                const {key, value} = dec.decodeUTF8StringPair();
                result.userProperty.set(key, value);
                propertyLen -= (key.length + value.length + 4);
                break;
            }
            default:
                throw new DecoderError("SUBSCRIBE: wrong property with identifier " + id);
        }
    }

    while (dec.remainingLength() > 0) {
        const subscription: MQTTSubscription = {topicFilter: dec.decodeUTF8String()};
        const options: number = dec.decodeByte();
        subscription.qos = (options & 0x03);
        subscription.noLocal = (options & 0x04) == 1;
        subscription.retainAsPublished = (options & 0x08) == 1;
        subscription.retainHandling = (options & 0x30);

        result.subscriptions.push(subscription);
    }

    return {pktID: pktID, result: result};
}

export namespace MQTTSubAckReason {
    export enum Code {
        GrantedQoS0 = 0x00,
        GrantedQoS1 = 0x01,
        GrantedQoS2 = 0x02,
        UnspecifiedError = MQTTCommonReasonCode.UnspecifiedError,
        ImplSpecificError = MQTTCommonReasonCode.ImplSpecificError,
        NotAuthorized = MQTTCommonReasonCode.NotAuthorized,
        TopicNameInvalid = MQTTCommonReasonCode.TopicNameInvalid,
        PacketIdentifierInUse = MQTTCommonReasonCode.PacketIdentifierInUse,
        QuotaExceeded = MQTTCommonReasonCode.QuotaExceeded,
        SharedSubscriptionsNotSupported = MQTTCommonReasonCode.SharedSubscriptionsNotSupported,
        SubscriptionIdsNotSupported = MQTTCommonReasonCode.SubscriptionIdsNotSupported,
        WildcardSubscriptionsNotSupported = MQTTCommonReasonCode.WildcardSubscriptionsNotSupported,
    }

    export const Name = new Map<Code, string>([
        [Code.GrantedQoS0, "Granted QoS 0"],
        [Code.GrantedQoS1, "Granted QoS 1"],
        [Code.GrantedQoS2, "Granted QoS 2"],
        [Code.UnspecifiedError, getCommonReasonCodeName(MQTTCommonReasonCode.UnspecifiedError)],
        [Code.ImplSpecificError, getCommonReasonCodeName(MQTTCommonReasonCode.ImplSpecificError)],
        [Code.NotAuthorized, getCommonReasonCodeName(MQTTCommonReasonCode.NotAuthorized)],
        [Code.TopicNameInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.TopicNameInvalid)],
        [Code.PacketIdentifierInUse, getCommonReasonCodeName(MQTTCommonReasonCode.PacketIdentifierInUse)],
        [Code.QuotaExceeded, getCommonReasonCodeName(MQTTCommonReasonCode.QuotaExceeded)],
        [Code.SharedSubscriptionsNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.SharedSubscriptionsNotSupported)],
        [Code.SubscriptionIdsNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.SubscriptionIdsNotSupported)],
        [Code.WildcardSubscriptionsNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.WildcardSubscriptionsNotSupported)],
    ]);

    export const Description = new Map<Code, string>([
        [Code.GrantedQoS0, "The subscription is accepted and the maximum QoS sent will be QoS 0. This might be a lower QoS than was requested."],
        [Code.GrantedQoS1, "The subscription is accepted and the maximum QoS sent will be QoS 1. This might be a lower QoS than was requested."],
        [Code.GrantedQoS2, "The subscription is accepted and any received QoS will be sent to this subscription."],
        [Code.UnspecifiedError, "The subscription is not accepted and the Server either does not wish to reveal the reason or none of the other Reason Codes apply."],
        [Code.ImplSpecificError, "The SUBSCRIBE is valid but the Server does not accept it."],
        [Code.NotAuthorized, "The Client is not authorized to make this subscription."],
        [Code.TopicNameInvalid, "The Topic Filter is correctly formed but is not allowed for this Client."],
        [Code.PacketIdentifierInUse, "The specified Packet Identifier is already in use."],
        [Code.QuotaExceeded, "An implementation or administrative imposed limit has been exceeded."],
        [Code.SharedSubscriptionsNotSupported, "The Server does not support Shared Subscriptions for this Client."],
        [Code.SubscriptionIdsNotSupported, "The Server does not support Subscription Identifiers; the subscription is not accepted."],
        [Code.WildcardSubscriptionsNotSupported, "The Server does not support Wildcard Subscriptions; the subscription is not accepted."],
    ]);
}

export type MQTTSubAck = {
    // Each reason code corresponds to a Topic Filter in the SUBSCRIBE packet being acknowledged
    // and matches the order of the Topic Filter in the SUBSCRIBE packet
    reasonCodes: MQTTSubAckReason.Code[];
    reasonString?: string;
    userProperty?: Map<string, string>;
}

export class SubAckPacket extends PacketWithID {
    private msg: MQTTSubAck;

    constructor(pktID: number, msg: MQTTSubAck) {
        super(pktID);
        this.msg = msg;
    }

    propertyLength(): number {
        return PropertySizeIfNotEmpty.fromUTF8StringPair(this.msg.userProperty)
            + PropertySizeIfNotEmpty.fromUTF8Str(this.msg.reasonString);
    }

    encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ReasonStringID, this.msg.reasonString);
        PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, this.msg.userProperty);
    }

    build(): Uint8Array | never {
        const propertyLen = this.propertyLength();

        const remainingLength = (2 + propertyLen + encodedVarUint32Size(propertyLen) + this.msg.reasonCodes.length);
        const encoder = new DataStreamEncoder(remainingLength + 2); // fixed header length = 1,  remaining len(varuint32)

        encoder.encodeByte((PacketType.SUBACK << 4));
        encoder.encodeVarUint32(remainingLength);

        encoder.encodeUint16(this.id);
        this.encodeProperties(encoder, propertyLen);

        this.msg.reasonCodes.forEach(el => {
            encoder.encodeByte(el);
        });
        return encoder.byteArray;
    }
}

export function decodeSubAckPacket(dec: DataStreamDecoder): {pktID: number, result: MQTTSubAck} {
    const pktID = dec.decodeUint16();
    let reasonString: string | undefined;
    let userProperty: Map<string, string> | undefined;

    // read properties
    let propertyLen = dec.decodeVarUint32();
    while (propertyLen > 0) {
        const id = dec.decodeVarUint32();
        propertyLen--;
        switch (id) {
            case PropertyID.ReasonStringID: {
                reasonString = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, reasonString);
                propertyLen -= (reasonString.length + 2);
                break;
            }

            case PropertyID.UserPropertyID: {
                if (!userProperty) {
                    userProperty = new Map<string, string>();
                }
                const {key, value} = dec.decodeUTF8StringPair();
                userProperty.set(key, value);
                propertyLen -= (key.length + value.length + 4);
                break;
            }

            default:
                throw new DecoderError("SUBACK: wrong property with identifier " + id);
        }
    }

    const payload = dec.decodeBinaryDataNoLength(dec.remainingLength());

    const result: MQTTSubAck = {reasonCodes: [], reasonString: reasonString, userProperty: userProperty};

    payload.forEach(el => {
        result.reasonCodes.push(el);
    });

    return {pktID: pktID, result: result};
}
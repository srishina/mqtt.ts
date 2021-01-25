import {decodeMQTTPublishResponse, PublishResponsePacket} from "./packet";
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, DataStreamDecoder} from "../utils/codec";
import {PacketType, PropertyID, MQTTCommonReasonCode, getCommonReasonCodeName} from '../utils/constants';

export namespace MQTTPubAckReason {
    export enum Code {
        Success = MQTTCommonReasonCode.Success,
        NoMatchingSubscribers = MQTTCommonReasonCode.NoMatchingSubscribers,
        UnspecifiedError = MQTTCommonReasonCode.UnspecifiedError,
        ImplSpecificError = MQTTCommonReasonCode.ImplSpecificError,
        NotAuthorized = MQTTCommonReasonCode.NotAuthorized,
        TopicNameInvalid = MQTTCommonReasonCode.TopicNameInvalid,
        PacketIdentifierInUse = MQTTCommonReasonCode.PacketIdentifierInUse,
        QuotaExceeded = MQTTCommonReasonCode.QuotaExceeded,
        PayloadFormatInvalid = MQTTCommonReasonCode.PayloadFormatInvalid,
    }

    export const Name = new Map<Code, string>([
        [Code.Success, getCommonReasonCodeName(MQTTCommonReasonCode.Success)],
        [Code.NoMatchingSubscribers, getCommonReasonCodeName(MQTTCommonReasonCode.NoMatchingSubscribers)],
        [Code.UnspecifiedError, getCommonReasonCodeName(MQTTCommonReasonCode.UnspecifiedError)],
        [Code.ImplSpecificError, getCommonReasonCodeName(MQTTCommonReasonCode.ImplSpecificError)],
        [Code.NotAuthorized, getCommonReasonCodeName(MQTTCommonReasonCode.NotAuthorized)],
        [Code.TopicNameInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.TopicNameInvalid)],
        [Code.PacketIdentifierInUse, getCommonReasonCodeName(MQTTCommonReasonCode.PacketIdentifierInUse)],
        [Code.QuotaExceeded, getCommonReasonCodeName(MQTTCommonReasonCode.QuotaExceeded)],
        [Code.PayloadFormatInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.PayloadFormatInvalid)],
    ]);
    export const Description = new Map<Code, string>([
        [Code.Success, "The message is accepted. Publication of the QoS 1 message proceeds."],
        [Code.NoMatchingSubscribers, `The message is accepted but there are no subscribers. This 
                                    is sent only by the Server. If the Server knows that there 
                                    are no matching subscribers, it MAY use this Reason Code instead of 0x00 (Success).`],
        [Code.UnspecifiedError, `The receiver does not accept the publish but either does not want to reveal
                                the reason, or it does not match one of the other values.`],
        [Code.ImplSpecificError, "The PUBLISH is valid but the receiver is not willing to accept it."],
        [Code.NotAuthorized, "The PUBLISH is not authorized."],
        [Code.TopicNameInvalid, "The Topic Name is not malformed, but is not accepted by this Client or Server."],
        [Code.PacketIdentifierInUse, `The Packet Identifier is already in use. This might indicate a
                                        mismatch in the Session State between the Client and Server.`],
        [Code.QuotaExceeded, "An implementation or administrative imposed limit has been exceeded."],
        [Code.PayloadFormatInvalid, "The payload format does not match the specified Payload Format Indicator."],
    ]);
}

export type MQTTPubAck = {
    reason: MQTTPubAckReason.Code;
    reasonString?: string;
    userProperty?: Map<string, string>;
}

export class MQTTPubAckPacket extends PublishResponsePacket {
    private msg: MQTTPubAck;
    constructor(pktID: number, msg: MQTTPubAck) {
        super(pktID);
        this.msg = msg;
    }

    propertyLength(): number {
        let propertyLen = 0;
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(this.msg.reasonString);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(this.msg.userProperty);

        return propertyLen;
    }

    encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ReasonStringID, this.msg.reasonString);
        PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, this.msg.userProperty);
    }

    hasProperties(): boolean {
        return (this.msg.reasonString ? true : false);
    }

    build(): Uint8Array | never {
        const byte0: number = PacketType.PUBACK << 4;
        return this.buildWitHeaderFlag(byte0, this.msg.reason);
    }
}

export function decodePubAckPacket(byte0: number, dec: DataStreamDecoder): {pktID: number, puback: MQTTPubAck} {
    const {pktID, result} = decodeMQTTPublishResponse(byte0, dec);
    return {
        pktID: pktID, puback: {reason: result.reasonCode, reasonString: result.reasonString, userProperty: result.userProperty}
    };
}

import {PacketWithID} from './packet'
import {PacketType, PropertyID, MQTTCommonReasonCode, getCommonReasonCodeName} from '../utils/constants'
import type { DataStreamDecoder} from '../utils/codec'
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, encodedVarUint32Size, PropertyDecoderOnlyOnce} from '../utils/codec'
import {DecoderError} from '../client/errors'

export type MQTTUnsubscribeProperties = {
    userProperty?: Map<string, string>;
}

export type MQTTUnsubscribe = {
    topicFilters: string[];
    properties?: MQTTUnsubscribeProperties;
};

export class UnsubscribePacket extends PacketWithID {
    private msg: MQTTUnsubscribe;

    constructor(pktID: number, msg: MQTTUnsubscribe) {
        super(pktID)
        this.msg = msg
    }

    propertyLength(): number {
        return this.msg.properties ? PropertySizeIfNotEmpty.fromUTF8StringPair(this.msg.properties.userProperty) : 0
    }

    encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen)
        if (this.msg.properties) {
            PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, this.msg.properties.userProperty)
        }
    }

    build(): Uint8Array | never {
        const propertyLen = this.propertyLength()

        let remainingLength = (2 + propertyLen + encodedVarUint32Size(propertyLen))
        this.msg.topicFilters.forEach(function (el) {
            remainingLength += (2 + el.length)
        })

        const encoder = new DataStreamEncoder(remainingLength + 2) // fixed header length = 1,  remaining len(varuint32)

        const headerFlag = (PacketType.UNSUBSCRIBE << 4) | 0x2
        encoder.encodeByte(headerFlag)
        encoder.encodeVarUint32(remainingLength)

        encoder.encodeUint16(this.id)
        // properties length
        this.encodeProperties(encoder, propertyLen)

        this.msg.topicFilters.forEach(function (el) {
            encoder.encodeUTF8String(el)
        })

        return encoder.byteArray
    }
}

export function decodeUnsubscribePacket(dec: DataStreamDecoder): {pktID: number, result: MQTTUnsubscribe} | never {
    const pktID = dec.decodeUint16()

    const data: MQTTUnsubscribe = {topicFilters: []}
    // decode properties
    let propertyLen = dec.decodeVarUint32()
    if (propertyLen > 0) {
        data.properties = {}
    }

    while (propertyLen > 0 && data.properties) {
        const id = dec.decodeVarUint32()
        propertyLen--
        switch (id) {
            case PropertyID.UserPropertyID: {
                if (!data.properties.userProperty) {
                    data.properties.userProperty = new Map<string, string>()
                }
                const {key, value} = dec.decodeUTF8StringPair()
                data.properties.userProperty.set(key, value)
                propertyLen -= (key.length + value.length + 4)
                break
            }
            default:
                throw new DecoderError('UNSUBSCRIBE: wrong property with identifier ' + id)
        }
    }

    while (dec.remainingLength() > 0) {
        data.topicFilters.push(dec.decodeUTF8String())
    }

    if (data.topicFilters.length == 0) {
        throw new Error('Subscription payload MUST contain atleast a topic - protocol error')
    }

    return {pktID: pktID, result: data}
}

export namespace MQTTUnsubAckReason {
    export enum Code {
        Success = MQTTCommonReasonCode.Success,
        NoSubscriptionExisted = 0x11,
        UnspecifiedError = MQTTCommonReasonCode.UnspecifiedError,
        ImplSpecificError = MQTTCommonReasonCode.ImplSpecificError,
        NotAuthorized = MQTTCommonReasonCode.NotAuthorized,
        TopicFilterInvalid = MQTTCommonReasonCode.TopicFilterInvalid,
        PacketIdentifierInUse = MQTTCommonReasonCode.PacketIdentifierInUse,
    }

    export const Name = new Map<Code, string>([
        [Code.Success, getCommonReasonCodeName(MQTTCommonReasonCode.Success)],
        [Code.NoSubscriptionExisted, 'No subscription existed'],
        [Code.UnspecifiedError, getCommonReasonCodeName(MQTTCommonReasonCode.UnspecifiedError)],
        [Code.ImplSpecificError, getCommonReasonCodeName(MQTTCommonReasonCode.ImplSpecificError)],
        [Code.NotAuthorized, getCommonReasonCodeName(MQTTCommonReasonCode.NotAuthorized)],
        [Code.TopicFilterInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.TopicFilterInvalid)],
        [Code.PacketIdentifierInUse, getCommonReasonCodeName(MQTTCommonReasonCode.PacketIdentifierInUse)],
    ])

    export const Description = new Map<Code, string>([
        [Code.Success, 'The subscription is deleted.'],
        [Code.NoSubscriptionExisted, 'No matching Topic Filter is being used by the Client.'],
        [Code.UnspecifiedError, 'The unsubscribe could not be completed and the Server either does not wish to reveal the reason or none of the other Reason Codes apply.'],
        [Code.ImplSpecificError, 'The UNSUBSCRIBE is valid but the Server does not accept it.'],
        [Code.NotAuthorized, 'The Client is not authorized to unsubscribe.'],
        [Code.TopicFilterInvalid, 'The Topic Filter is correctly formed but is not allowed for this Client.'],
        [Code.PacketIdentifierInUse, 'The specified Packet Identifier is already in use.'],
    ])
}

export type MQTTUnsubAck = {
    // Each reason code corresponds to a Topic Filter in the UNSUBSCRIBE packet being acknowledged
    // and matches the order of the Topic Filter in the UNSUBSCRIBE packet
    reasonCodes: MQTTUnsubAckReason.Code[];
    reasonString?: string;
    userProperty?: Map<string, string>;
}

export class UnsubAckPacket extends PacketWithID {
    private msg: MQTTUnsubAck;

    constructor(pktID: number, msg: MQTTUnsubAck) {
        super(pktID)
        this.msg = msg
    }

    propertyLength(): number {
        return PropertySizeIfNotEmpty.fromUTF8StringPair(this.msg.userProperty)
            + PropertySizeIfNotEmpty.fromUTF8Str(this.msg.reasonString)
    }

    encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen)
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ReasonStringID, this.msg.reasonString)
        PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, this.msg.userProperty)
    }

    build(): Uint8Array | never {
        const propertyLen = this.propertyLength()

        const remainingLength = (2 + propertyLen + encodedVarUint32Size(propertyLen) + this.msg.reasonCodes.length)
        const encoder = new DataStreamEncoder(remainingLength + 2) // fixed header length = 1,  remaining len(varuint32)

        encoder.encodeByte((PacketType.UNSUBACK << 4))
        encoder.encodeVarUint32(remainingLength)

        encoder.encodeUint16(this.id)
        this.encodeProperties(encoder, propertyLen)

        this.msg.reasonCodes.forEach(el => {
            encoder.encodeByte(el)
        })

        return encoder.byteArray
    }
}

export function decodeUnsubAckPacket(dec: DataStreamDecoder): {pktID: number, result: MQTTUnsubAck} {
    const pktID = dec.decodeUint16()
    let reasonString: string | undefined
    let userProperty: Map<string, string> | undefined

    // read properties
    let propertyLen = dec.decodeVarUint32()
    while (propertyLen > 0) {
        const id = dec.decodeVarUint32()
        propertyLen--
        switch (id) {
            case PropertyID.ReasonStringID: {
                reasonString = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, reasonString)
                propertyLen -= (reasonString.length + 2)
                break
            }

            case PropertyID.UserPropertyID: {
                if (!userProperty) {
                    userProperty = new Map<string, string>()
                }
                const {key, value} = dec.decodeUTF8StringPair()
                userProperty.set(key, value)
                propertyLen -= (key.length + value.length + 4)
                break
            }

            default:
                throw new DecoderError('UNSUBACK: wrong property with identifier ' + id)
        }
    }

    const payload = dec.decodeBinaryDataNoLength(dec.remainingLength())
    const result: MQTTUnsubAck = {reasonCodes: [], reasonString: reasonString, userProperty: userProperty}
    payload.forEach(el => {
        result.reasonCodes.push(el)
    })

    return {pktID: pktID, result: result}
}

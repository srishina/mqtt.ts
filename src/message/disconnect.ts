import { DecoderError } from '../client/errors'
import type { DataStreamDecoder } from '../utils/codec'
import { PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, encodedVarUint32Size, PropertyDecoderOnlyOnce } from '../utils/codec'
import { PacketType, PropertyID, MQTTCommonReasonCode, getCommonReasonCodeName } from '../utils/constants'

export class MQTTDisconnectReason {
    private reasonCode: MQTTDisconnectReason.Code;
    constructor(code: MQTTDisconnectReason.Code) {
        this.reasonCode = code
    }

    getCode(): MQTTDisconnectReason.Code {
        return this.reasonCode
    }

    getName(): string {
        return MQTTDisconnectReason.Name.has(this.reasonCode)
            ? MQTTDisconnectReason.Name.get(this.reasonCode) as string : ''
    }

    getDescription(): string {
        return MQTTDisconnectReason.Description.has(this.reasonCode)
            ? MQTTDisconnectReason.Description.get(this.reasonCode) as string : ''
    }
}

export namespace MQTTDisconnectReason {
    export const enum Code {
        NormalDisconnection = 0x00,
        DisconnectWithWillMessage = 0x04,
        UnspecifiedError = MQTTCommonReasonCode.UnspecifiedError,
        MalformedPacket = MQTTCommonReasonCode.MalformedPacket,
        ProtocolError = MQTTCommonReasonCode.ProtocolError,
        ImplSpecificError = MQTTCommonReasonCode.ImplSpecificError,
        NotAuthorized = MQTTCommonReasonCode.NotAuthorized,
        ServerBusy = MQTTCommonReasonCode.ServerBusy,
        ServerShuttingDown = 0x8B,
        KeepAliveTimeout = 0x8D,
        SessionTakenOver = 0x8E,
        TopicFilterInvalid = MQTTCommonReasonCode.TopicFilterInvalid,
        TopicNameInvalid = MQTTCommonReasonCode.TopicNameInvalid,
        ReceiveMaximumExceeded = 0x93,
        TopicAliasInvalid = 0x94,
        PacketTooLarge = MQTTCommonReasonCode.PacketTooLarge,
        MessageRateTooHigh = 0x96,
        QuotaExceeded = MQTTCommonReasonCode.QuotaExceeded,
        AdministrativeAction = 0x98,
        PayloadFormatInvalid = MQTTCommonReasonCode.PayloadFormatInvalid,
        RetainNotSupported = 0x9A,
        QoSNotSupported = MQTTCommonReasonCode.QoSNotSupported,
        UseAnotherServer = MQTTCommonReasonCode.UseAnotherServer,
        ServerMoved = MQTTCommonReasonCode.ServerMoved,
        SharedSubscriptionsNotSupported = MQTTCommonReasonCode.SharedSubscriptionsNotSupported,
        ConnectionRateExceeded = MQTTCommonReasonCode.ConnectionRateExceeded,
        MaximumConnectTime = 0xA0,
        SubscriptionIdenfifierNotSupported = 0xA1,
        WoldCardSubscriptionsNotSupported = 0xA2,
    }
    export const Name = new Map<Code, string>([
        [Code.NormalDisconnection, 'Normal disconnection'],
        [Code.DisconnectWithWillMessage, 'Disconnect with Will Message'],
        [Code.UnspecifiedError, getCommonReasonCodeName(MQTTCommonReasonCode.UnspecifiedError)],
        [Code.MalformedPacket, getCommonReasonCodeName(MQTTCommonReasonCode.MalformedPacket)],
        [Code.ProtocolError, getCommonReasonCodeName(MQTTCommonReasonCode.ProtocolError)],
        [Code.ImplSpecificError, getCommonReasonCodeName(MQTTCommonReasonCode.ImplSpecificError)],
        [Code.NotAuthorized, getCommonReasonCodeName(MQTTCommonReasonCode.NotAuthorized)],
        [Code.ServerBusy, getCommonReasonCodeName(MQTTCommonReasonCode.ServerBusy)],
        [Code.ServerShuttingDown, 'Server shutting down'],
        [Code.KeepAliveTimeout, 'Keep Alive timeout'],
        [Code.SessionTakenOver, 'Session taken over'],
        [Code.TopicFilterInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.TopicFilterInvalid)],
        [Code.TopicNameInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.TopicNameInvalid)],
        [Code.ReceiveMaximumExceeded, 'Receive Maximum exceeded'],
        [Code.TopicAliasInvalid, 'Topic Alias invalid'],
        [Code.PacketTooLarge, getCommonReasonCodeName(MQTTCommonReasonCode.PacketTooLarge)],
        [Code.MessageRateTooHigh, 'Message rate too high'],
        [Code.QuotaExceeded, getCommonReasonCodeName(MQTTCommonReasonCode.QuotaExceeded)],
        [Code.AdministrativeAction, 'Administrative action'],
        [Code.PayloadFormatInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.PayloadFormatInvalid)],
        [Code.RetainNotSupported, 'Retain not supported'],
        [Code.QoSNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.QoSNotSupported)],
        [Code.UseAnotherServer, getCommonReasonCodeName(MQTTCommonReasonCode.UseAnotherServer)],
        [Code.ServerMoved, getCommonReasonCodeName(MQTTCommonReasonCode.ServerMoved)],
        [Code.SharedSubscriptionsNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.SharedSubscriptionsNotSupported)],
        [Code.ConnectionRateExceeded, getCommonReasonCodeName(MQTTCommonReasonCode.ConnectionRateExceeded)],
        [Code.MaximumConnectTime, 'Maximum connect time'],
        [Code.SubscriptionIdenfifierNotSupported, 'Subscription Identifiers not supported'],
        [Code.WoldCardSubscriptionsNotSupported, 'Wildcard Subscriptions not supported'],
    ])
    export const Description = new Map<Code, string>([
        [Code.NormalDisconnection, 'Close the connection normally. Do not send the Will Message.'],
        [Code.DisconnectWithWillMessage, 'The Client wishes to disconnect but requires that the Server also publishes its Will Message.'],
        [Code.UnspecifiedError, 'The Connection is closed but the sender either does not wish to reveal the reason, or none of the other Reason Codes apply.'],
        [Code.MalformedPacket, 'The received packet does not conform to this specification.'],
        [Code.ProtocolError, 'An unexpected or out of order packet was received.'],
        [Code.ImplSpecificError, 'The packet received is valid but cannot be processed by this implementation.'],
        [Code.NotAuthorized, 'The request is not authorized.'],
        [Code.ServerBusy, 'The Server is busy and cannot continue processing requests from this Client.'],
        [Code.ServerShuttingDown, 'The Server is shutting down.'],
        [Code.KeepAliveTimeout, 'The Connection is closed because no packet has been received for 1.5 times the Keepalive time.'],
        [Code.SessionTakenOver, 'Another Connection using the same ClientID has connected causing this Connection to be closed.'],
        [Code.TopicFilterInvalid, 'The Topic Filter is correctly formed, but is not accepted by this Sever.'],
        [Code.TopicNameInvalid, 'The Topic Name is correctly formed, but is not accepted by this Client or Server.'],
        [Code.ReceiveMaximumExceeded, 'The Client or Server has received more than Receive Maximum publication for which it has not sent PUBACK or PUBCOMP.'],
        [Code.TopicAliasInvalid, 'The Client or Server has received a PUBLISH packet containing a Topic Alias which is greater than the Maximum Topic Alias it sent in the CONNECT or CONNACK packet.'],
        [Code.PacketTooLarge, 'The packet size is greater than Maximum Packet Size for this Client or Server.'],
        [Code.MessageRateTooHigh, 'The received data rate is too high.'],
        [Code.QuotaExceeded, 'Quota exceeded'],
        [Code.AdministrativeAction, 'The Connection is closed due to an administrative action.'],
        [Code.PayloadFormatInvalid, 'The payload format does not match the one specified by the Payload Format Indicator.'],
        [Code.RetainNotSupported, 'The Server has does not support retained messages.'],
        [Code.QoSNotSupported, 'The Client specified a QoS greater than the QoS specified in a Maximum QoS in the CONNACK.'],
        [Code.UseAnotherServer, 'The Client should temporarily change its Server.'],
        [Code.ServerMoved, 'The Server is moved and the Client should permanently change its server location.'],
        [Code.SharedSubscriptionsNotSupported, 'The Server does not support Shared Subscriptions.'],
        [Code.ConnectionRateExceeded, 'This connection is closed because the connection rate is too high.'],
        [Code.MaximumConnectTime, 'The maximum connection time authorized for this connection has been exceeded.'],
        [Code.SubscriptionIdenfifierNotSupported, 'The Server does not support Subscription Identifiers; the subscription is not accepted.'],
        [Code.WoldCardSubscriptionsNotSupported, 'The Server does not support Wildcard Subscriptions; the subscription is not accepted.'],
    ])
}

export type MQTTDisconnectProperties = {
    sessionExpiryInterval?: number;
    reasonString?: string
    userProperty?: Map<string, string>;
    serverReference?: string;
}

export type MQTTDisconnect = {
    reasonCode: MQTTDisconnectReason.Code;
    properties?: MQTTDisconnectProperties;
}

export function encodeDisconnectPacket(msg: MQTTDisconnect): Uint8Array | never {
    function propertyLength(): number {
        let propertyLen = 0
        if (msg.properties) {
            propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.properties.sessionExpiryInterval)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.reasonString)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(msg.properties.userProperty)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.serverReference)
        }
        return propertyLen
    }

    function encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen)
        if (msg.properties) {
            PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.SessionExpiryIntervalID, msg.properties.sessionExpiryInterval)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ReasonStringID, msg.properties.reasonString)
            PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, msg.properties.userProperty)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ServerReferenceID, msg.properties.serverReference)
        }
    }

    function hasProperties(): boolean {
        return ((msg.properties) ? true : false)
    }

    const propertyLen = propertyLength()

    let remainingLength = 0

    // The Reason Code and Property Length can be omitted
    // if the Reason Code is 0x00 (Success) 1849 and there are no Properties.
    if (((msg.reasonCode != 0x00) || hasProperties())) {
        remainingLength += (1 + propertyLen + encodedVarUint32Size(propertyLen))
    }

    const encoder = new DataStreamEncoder(remainingLength + 2) // fixed header length = 1,  remaining len(varuint32)
    const byte0: number = PacketType.DISCONNECT << 4
    encoder.encodeByte(byte0)

    encoder.encodeVarUint32(remainingLength)

    if (remainingLength != 0) {
        encoder.encodeByte(msg.reasonCode)
        encodeProperties(encoder, propertyLen)
    }

    return encoder.byteArray
}

export function decodeDisconnectPacket(dec: DataStreamDecoder): MQTTDisconnect {
    const data: MQTTDisconnect = { reasonCode: dec.decodeByte() }
    // read the properties
    let propertyLen = dec.decodeVarUint32()
    if (propertyLen > 0) {
        data.properties = {}
    }

    while (propertyLen > 0 && data.properties) {
        const id = dec.decodeVarUint32()
        propertyLen--
        switch (id) {
            case PropertyID.SessionExpiryIntervalID:
                data.properties.sessionExpiryInterval = PropertyDecoderOnlyOnce.toUint32(dec, id, data.properties.sessionExpiryInterval)
                propertyLen -= 4
                break
            case PropertyID.ReasonStringID: {
                data.properties.reasonString = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.reasonString)
                propertyLen -= (data.properties.reasonString.length + 2)
                break
            }
            case PropertyID.UserPropertyID: {
                if (!data.properties.userProperty) {
                    data.properties.userProperty = new Map<string, string>()
                }
                const { key, value } = dec.decodeUTF8StringPair()
                data.properties.userProperty.set(key, value)
                propertyLen -= (key.length + value.length + 4)
                break
            }
            case PropertyID.ServerReferenceID:
                data.properties.serverReference = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.serverReference)
                propertyLen -= (data.properties.serverReference.length + 2)
                break
            default:
                throw new DecoderError('DISCONNECT: wrong property with identifier ' + id)
        }
    }

    return data
}

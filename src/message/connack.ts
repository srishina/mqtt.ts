import {PropertyID, MQTTCommonReasonCode, PacketType, getPropertyText, getCommonReasonCodeName} from '../utils/constants'
import type { DataStreamDecoder} from "../utils/codec"
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, encodedVarUint32Size, PropertyDecoderOnlyOnce} from "../utils/codec"
import {DecoderError} from '../client/errors'

export namespace MQTTConnAckReason {
    export enum Code {
        Success = MQTTCommonReasonCode.Success,
        UnspecifiedError = MQTTCommonReasonCode.UnspecifiedError,
        MalformedPacket = MQTTCommonReasonCode.MalformedPacket,
        ProtocolError = MQTTCommonReasonCode.ProtocolError,
        ImplSpecificError = MQTTCommonReasonCode.ImplSpecificError,
        UnsupportedProtocolVer = 0x84, // CONNACK
        ClientIDNotValud = 0x85, // CONNACK
        BadUsernameOrPWD = 0x86, // CONNACK
        NotAuthorized = MQTTCommonReasonCode.NotAuthorized,
        ServerUnavailable = 0x88, // CONNACK
        ServerBusy = MQTTCommonReasonCode.ServerBusy,
        Banned = 0x8A, // CONNACK
        BadAuthMethod = 0x8C, // CONNACK
        TopicNameInvalid = MQTTCommonReasonCode.TopicNameInvalid,
        PacketTooLarge = MQTTCommonReasonCode.PacketTooLarge,
        QuotaExceeded = MQTTCommonReasonCode.QuotaExceeded,
        PayloadFormatInvalid = MQTTCommonReasonCode.PayloadFormatInvalid,
        RetainNotSupported = MQTTCommonReasonCode.RetainNotSupported,
        QoSNotSupported = MQTTCommonReasonCode.QoSNotSupported,
        UseAnotherServer = MQTTCommonReasonCode.UseAnotherServer,
        ServerMoved = MQTTCommonReasonCode.ServerMoved,
        ConnectionRateExceeded = MQTTCommonReasonCode.ConnectionRateExceeded,
    }

    export const Name = new Map<Code, string>([
        [Code.Success, getCommonReasonCodeName(MQTTCommonReasonCode.Success)],
        [Code.UnspecifiedError, getCommonReasonCodeName(MQTTCommonReasonCode.UnspecifiedError)],
        [Code.MalformedPacket, getCommonReasonCodeName(MQTTCommonReasonCode.MalformedPacket)],
        [Code.ProtocolError, getCommonReasonCodeName(MQTTCommonReasonCode.ProtocolError)],
        [Code.ImplSpecificError, getCommonReasonCodeName(MQTTCommonReasonCode.ImplSpecificError)],
        [Code.UnsupportedProtocolVer, "Unsupported Protocol Version"],
        [Code.ClientIDNotValud, "Client Identifier not valid"],
        [Code.BadUsernameOrPWD, "Bad User Name or Password"],
        [Code.NotAuthorized, getCommonReasonCodeName(MQTTCommonReasonCode.NotAuthorized)],
        [Code.ServerUnavailable, "Server unavailable"],
        [Code.ServerBusy, "Server busy"],
        [Code.Banned, "Banned"],
        [Code.BadAuthMethod, "Bad authentication method"],
        [Code.TopicNameInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.TopicNameInvalid)],
        [Code.PacketTooLarge, getCommonReasonCodeName(MQTTCommonReasonCode.PacketTooLarge)],
        [Code.QuotaExceeded, getCommonReasonCodeName(MQTTCommonReasonCode.QuotaExceeded)],
        [Code.PayloadFormatInvalid, getCommonReasonCodeName(MQTTCommonReasonCode.PayloadFormatInvalid)],
        [Code.RetainNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.RetainNotSupported)],
        [Code.QoSNotSupported, getCommonReasonCodeName(MQTTCommonReasonCode.QoSNotSupported)],
        [Code.UseAnotherServer, getCommonReasonCodeName(MQTTCommonReasonCode.UseAnotherServer)],
        [Code.ServerMoved, getCommonReasonCodeName(MQTTCommonReasonCode.ServerMoved)],
        [Code.ConnectionRateExceeded, getCommonReasonCodeName(MQTTCommonReasonCode.ConnectionRateExceeded)],
    ])

    export const Description = new Map<Code, string>([
        [Code.Success, "The Connection is accepted."],
        [Code.UnspecifiedError, "The Server does not wish to reveal the reason for the failure, or none of the other Reason Codes apply."],
        [Code.MalformedPacket, "Data within the CONNECT packet could not be correctly parsed. "],
        [Code.ProtocolError, "Data in the CONNECT packet does not conform to this specification."],
        [Code.ImplSpecificError, "The CONNECT is valid but is not accepted by this Server."],
        [Code.UnsupportedProtocolVer, "The Server does not support the version of the MQTT protocol requested by the Client."],
        [Code.ClientIDNotValud, "The Client Identifier is a valid string but is not allowed by the Server."],
        [Code.BadUsernameOrPWD, "The Server does not accept the User Name or Password specified by the Client "],
        [Code.NotAuthorized, "The Client is not authorized to connect."],
        [Code.ServerUnavailable, "The MQTT Server is not available."],
        [Code.ServerBusy, "The Server is busy. Try again later."],
        [Code.Banned, "This Client has been banned by administrative action. Contact the server administrator."],
        [Code.BadAuthMethod, "The authentication method is not supported or does not match the authentication method currently in use."],
        [Code.TopicNameInvalid, "The Will Topic Name is not malformed, but is not accepted by this Server."],
        [Code.PacketTooLarge, "The CONNECT packet exceeded the maximum permissible size."],
        [Code.QuotaExceeded, "An implementation or administrative imposed limit has been exceeded."],
        [Code.PayloadFormatInvalid, "The Will Payload does not match the specified Payload Format Indicator."],
        [Code.RetainNotSupported, "The Server does not support retained messages, and Will Retain was set to 1."],
        [Code.QoSNotSupported, "The Server does not support the QoS set in Will QoS."],
        [Code.UseAnotherServer, "The Client should temporarily use another server."],
        [Code.ServerMoved, "The Client should permanently use another server."],
        [Code.ConnectionRateExceeded, "The connection rate limit has been exceeded."],
    ])
}

export type MQTTConnAckProperties = {
    sessionExpiryInterval?: number;
    receiveMaximum?: number;
    maximumQoS?: number;
    retainAvailable?: boolean;
    maximumPacketSize?: number;
    assignedClientIdentifier?: string;
    topicAliasMaximum?: number;
    reasonString?: string;
    userProperty?: Map<string, string>;
    // A value is 0 means that Wildcard Subscriptions are not supported.
    // A value of 1 means Wildcard Subscriptions are supported. If not present, then Wildcard Subscriptions are supported.
    wildcardSubscriptionAvailable?: boolean;
    // value is 0 means that Subscription Identifiers are not supported.
    // A value of 1 means Subscription Identifiers are supported. If not present, then Subscription Identifiers are supported.
    subscriptionIdentifierAvailable?: boolean;
    // A value is 0 means that Shared Subscriptions are not supported.
    // A value of 1 means Shared Subscriptions are supported. If not present, then Shared Subscriptions are supported.
    sharedSubscriptionAvailable?: boolean;
    serverKeepAlive?: number;
    responseInformation?: string;
    serverReference?: string;
    authenticationMethod?: string;
    authenticationData?: Uint8Array;
}

export type MQTTConnAck = {
    sessionPresent: boolean;
    reasonCode: MQTTConnAckReason.Code;

    properties?: MQTTConnAckProperties
}

export function encodeConnAckPacket(msg: MQTTConnAck): Uint8Array | never {
    function propertyLength(): number {
        let propertyLen = 0
        if (msg.properties) {
            propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.properties.sessionExpiryInterval)
            propertyLen += PropertySizeIfNotEmpty.fromUint16(msg.properties.receiveMaximum)
            propertyLen += PropertySizeIfNotEmpty.fromByte(msg.properties.maximumQoS)
            propertyLen += PropertySizeIfNotEmpty.fromBool(msg.properties.retainAvailable)
            propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.properties.maximumPacketSize)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.assignedClientIdentifier)
            propertyLen += PropertySizeIfNotEmpty.fromUint16(msg.properties.topicAliasMaximum)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.reasonString)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(msg.properties.userProperty)
            propertyLen += PropertySizeIfNotEmpty.fromBool(msg.properties.wildcardSubscriptionAvailable)
            propertyLen += PropertySizeIfNotEmpty.fromBool(msg.properties.subscriptionIdentifierAvailable)
            propertyLen += PropertySizeIfNotEmpty.fromBool(msg.properties.sharedSubscriptionAvailable)
            propertyLen += PropertySizeIfNotEmpty.fromByte(msg.properties.serverKeepAlive)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.responseInformation)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.serverReference)
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.authenticationMethod)
            propertyLen += PropertySizeIfNotEmpty.fromBinaryData(msg.properties.authenticationData)
        }
        return propertyLen
    }

    function encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen)
        if (msg.properties) {
            PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.SessionExpiryIntervalID, msg.properties.sessionExpiryInterval)
            PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.ReceiveMaximumID, msg.properties.receiveMaximum)
            PropertyEncoderIfNotEmpty.fromByte(enc, PropertyID.MaximumQoSID, msg.properties.maximumQoS)
            PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.RetainAvailableID, msg.properties.retainAvailable)
            PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.MaximumPacketSizeID, msg.properties.maximumPacketSize)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.AssignedClientIdentifierID, msg.properties.assignedClientIdentifier)
            PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.TopicAliasMaximumID, msg.properties.topicAliasMaximum)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ReasonStringID, msg.properties.reasonString)
            PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, msg.properties.userProperty)
            PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.WildcardSubscriptionAvailableID, msg.properties.wildcardSubscriptionAvailable)
            PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.SubscriptionIdentifierAvailableID, msg.properties.subscriptionIdentifierAvailable)
            PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.SharedSubscriptionAvailableID, msg.properties.sharedSubscriptionAvailable)
            PropertyEncoderIfNotEmpty.fromByte(enc, PropertyID.ServerKeepAliveID, msg.properties.serverKeepAlive)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ResponseInformationID, msg.properties.responseInformation)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ServerReferenceID, msg.properties.serverReference)
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.AuthenticationMethodID, msg.properties.authenticationMethod)
            PropertyEncoderIfNotEmpty.fromBinaryData(enc, PropertyID.AuthenticationDataID, msg.properties.authenticationData)
        }
    }

    const propertyLen = propertyLength()

    // Session present, reason code
    const remainingLength = 2 + encodedVarUint32Size(propertyLen) + propertyLen

    const encoder = new DataStreamEncoder(remainingLength + 2) // fixed header length, + remaining len(uint16)
    encoder.encodeByte(PacketType.CONNACK << 4)
    encoder.encodeVarUint32(remainingLength)

    encoder.encodeBool(msg.sessionPresent)
    encoder.encodeByte(msg.reasonCode)

    encodeProperties(encoder, propertyLen)

    return encoder.byteArray
}

// receiveMaximum: 65535, // Default - 65535
// maximumQoS: 2,
// retainAvailable: true,  // defailt - supported
// wildcardSubscriptionAvailable: true, // defailt - supported
// subscriptionIdentifierAvailable: true, // defailt - supported
// sharedSubscriptionAvailable: true, // defailt - supported

export function decodeConnAckPacket(dec: DataStreamDecoder): MQTTConnAck {
    const sessionPresent = dec.decodeBool()
    const reasonCode: MQTTConnAckReason.Code = dec.decodeByte()

    const data: MQTTConnAck = {
        sessionPresent: sessionPresent,
        reasonCode: reasonCode,
    }

    // read the properties
    let propertyLen = dec.decodeVarUint32()
    if (propertyLen > 0) {
        data.properties = {}
    }

    while (propertyLen > 0 && data.properties) {
        const id = dec.decodeVarUint32()
        propertyLen--
        switch (id) {
            case PropertyID.SessionExpiryIntervalID: {
                data.properties.sessionExpiryInterval = PropertyDecoderOnlyOnce.toUint32(dec, id, data.properties.sessionExpiryInterval)
                propertyLen -= 4
                break
            }

            case PropertyID.ReceiveMaximumID: {
                data.properties.receiveMaximum = PropertyDecoderOnlyOnce.toUint16(dec, id, data.properties.receiveMaximum)
                if (data.properties.receiveMaximum == 0) {
                    throw new Error(getPropertyText(id) + " must not be 0")
                }
                propertyLen -= 2
                break
            }

            case PropertyID.MaximumQoSID: {
                data.properties.maximumQoS = PropertyDecoderOnlyOnce.toByte(dec, id, data.properties.maximumQoS)
                if (data.properties.maximumQoS != 0 && data.properties.maximumQoS != 1) {
                    throw new Error(getPropertyText(id) + " wrong maximum Qos")
                }
                propertyLen--
                break
            }

            case PropertyID.RetainAvailableID: {
                data.properties.retainAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.properties.retainAvailable)
                propertyLen--
                break
            }

            case PropertyID.MaximumPacketSizeID: {
                data.properties.maximumPacketSize = PropertyDecoderOnlyOnce.toUint32(dec, id, data.properties.maximumPacketSize)
                if (data.properties.maximumPacketSize == 0) {
                    throw new Error(getPropertyText(id) + " must not be 0")
                }

                propertyLen -= 4
                break
            }

            case PropertyID.AssignedClientIdentifierID: {
                data.properties.assignedClientIdentifier = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.assignedClientIdentifier)
                propertyLen -= (data.properties.assignedClientIdentifier.length + 2)
                break
            }

            case PropertyID.TopicAliasMaximumID: {
                data.properties.topicAliasMaximum = PropertyDecoderOnlyOnce.toUint16(dec, id, data.properties.topicAliasMaximum)
                propertyLen -= 2
                break
            }

            case PropertyID.ReasonStringID: {
                data.properties.reasonString = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.reasonString)
                propertyLen -= (data.properties.reasonString.length + 2)
                break
            }

            case PropertyID.UserPropertyID: {
                if (!data.properties.userProperty) {
                    data.properties.userProperty = new Map<string, string>()
                }
                const {key, value} = dec.decodeUTF8StringPair()
                data.properties.userProperty.set(key, value)
                propertyLen -= (key.length + value.length + 4)
                break
            }

            case PropertyID.WildcardSubscriptionAvailableID: {
                data.properties.wildcardSubscriptionAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.properties.wildcardSubscriptionAvailable)
                propertyLen--
                break
            }

            case PropertyID.SubscriptionIdentifierAvailableID: {
                data.properties.subscriptionIdentifierAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.properties.subscriptionIdentifierAvailable)
                propertyLen--
                break
            }

            case PropertyID.SharedSubscriptionAvailableID: {
                data.properties.sharedSubscriptionAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.properties.sharedSubscriptionAvailable)
                propertyLen--
                break
            }

            case PropertyID.ServerKeepAliveID: {
                data.properties.serverKeepAlive = PropertyDecoderOnlyOnce.toUint16(dec, id, data.properties.serverKeepAlive)
                propertyLen -= 2
                break
            }

            case PropertyID.ResponseInformationID: {
                data.properties.responseInformation = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.responseInformation)
                propertyLen -= (data.properties.responseInformation.length + 2)
                break
            }

            case PropertyID.ServerReferenceID: {
                data.properties.serverReference = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.serverReference)
                propertyLen -= (data.properties.serverReference.length + 2)
                break
            }

            case PropertyID.AuthenticationMethodID: {
                data.properties.authenticationMethod = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.authenticationMethod)
                propertyLen -= (data.properties.authenticationMethod.length + 2)
                break
            }

            case PropertyID.AuthenticationDataID: {
                data.properties.authenticationData = PropertyDecoderOnlyOnce.toBinaryData(dec, id, data.properties.authenticationData)
                propertyLen -= (data.properties.authenticationData.length + 2)
                break
            }
            default:
                throw new DecoderError("CONNACK: wrong property with identifier " + id)
        }
    }

    return data
}

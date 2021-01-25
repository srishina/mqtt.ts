import {PropertyID, MQTTCommonReasonCode, PacketType, getPropertyText, getCommonReasonCodeName} from '../utils/constants';
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamDecoder, DataStreamEncoder, encodedVarUint32Size, PropertyDecoderOnlyOnce} from "../utils/codec";
import {DecoderError} from '../client/errors';

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
    ]);

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
    ]);
}

export type MQTTConnAck = {
    sessionPresent: boolean;
    reasonCode: MQTTConnAckReason.Code;

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

export function encodeConnAckPacket(msg: MQTTConnAck): Uint8Array | never {
    function propertyLength(): number {
        let propertyLen = 0;
        propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.sessionExpiryInterval);
        propertyLen += PropertySizeIfNotEmpty.fromUint16(msg.receiveMaximum);
        propertyLen += PropertySizeIfNotEmpty.fromByte(msg.maximumQoS);
        propertyLen += PropertySizeIfNotEmpty.fromBool(msg.retainAvailable);
        propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.maximumPacketSize);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.assignedClientIdentifier);
        propertyLen += PropertySizeIfNotEmpty.fromUint16(msg.topicAliasMaximum);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.reasonString);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(msg.userProperty);
        propertyLen += PropertySizeIfNotEmpty.fromBool(msg.wildcardSubscriptionAvailable);
        propertyLen += PropertySizeIfNotEmpty.fromBool(msg.subscriptionIdentifierAvailable);
        propertyLen += PropertySizeIfNotEmpty.fromBool(msg.sharedSubscriptionAvailable);
        propertyLen += PropertySizeIfNotEmpty.fromByte(msg.serverKeepAlive);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.responseInformation);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.serverReference);
        propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.authenticationMethod);
        propertyLen += PropertySizeIfNotEmpty.fromBinaryData(msg.authenticationData);
        return propertyLen;
    }

    function encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen);

        PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.SessionExpiryIntervalID, msg.sessionExpiryInterval);
        PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.ReceiveMaximumID, msg.receiveMaximum);
        PropertyEncoderIfNotEmpty.fromByte(enc, PropertyID.MaximumQoSID, msg.maximumQoS);
        PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.RetainAvailableID, msg.retainAvailable);
        PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.MaximumPacketSizeID, msg.maximumPacketSize);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.AssignedClientIdentifierID, msg.assignedClientIdentifier);
        PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.TopicAliasMaximumID, msg.topicAliasMaximum);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ReasonStringID, msg.reasonString);
        PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, msg.userProperty);
        PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.WildcardSubscriptionAvailableID, msg.wildcardSubscriptionAvailable);
        PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.SubscriptionIdentifierAvailableID, msg.subscriptionIdentifierAvailable);
        PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.SharedSubscriptionAvailableID, msg.sharedSubscriptionAvailable);
        PropertyEncoderIfNotEmpty.fromByte(enc, PropertyID.ServerKeepAliveID, msg.serverKeepAlive);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ResponseInformationID, msg.responseInformation);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.ServerReferenceID, msg.serverReference);
        PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.AuthenticationMethodID, msg.authenticationMethod);
        PropertyEncoderIfNotEmpty.fromBinaryData(enc, PropertyID.AuthenticationDataID, msg.authenticationData);
    }

    const propertyLen = propertyLength();

    // Session present, reason code
    const remainingLength = 2 + encodedVarUint32Size(propertyLen) + propertyLen;

    const encoder = new DataStreamEncoder(remainingLength + 2); // fixed header length, + remaining len(uint16)
    encoder.encodeByte(PacketType.CONNACK << 4);
    encoder.encodeVarUint32(remainingLength);

    encoder.encodeBool(msg.sessionPresent);
    encoder.encodeByte(msg.reasonCode);

    encodeProperties(encoder, propertyLen);

    return encoder.byteArray;
}

// receiveMaximum: 65535, // Default - 65535
// maximumQoS: 2,
// retainAvailable: true,  // defailt - supported
// wildcardSubscriptionAvailable: true, // defailt - supported
// subscriptionIdentifierAvailable: true, // defailt - supported
// sharedSubscriptionAvailable: true, // defailt - supported

export function decodeConnAckPacket(dec: DataStreamDecoder): MQTTConnAck {
    const sessionPresent = dec.decodeBool();
    const reasonCode: MQTTConnAckReason.Code = dec.decodeByte();

    const data: MQTTConnAck = {
        sessionPresent: sessionPresent,
        reasonCode: reasonCode,
    };

    // read the properties
    let propertyLen = dec.decodeVarUint32();
    while (propertyLen > 0) {
        const id = dec.decodeVarUint32();
        propertyLen--;
        switch (id) {
            case PropertyID.SessionExpiryIntervalID: {
                data.sessionExpiryInterval = PropertyDecoderOnlyOnce.toUint32(dec, id, data.sessionExpiryInterval);
                propertyLen -= 4;
                break;
            }

            case PropertyID.ReceiveMaximumID: {
                data.receiveMaximum = PropertyDecoderOnlyOnce.toUint16(dec, id, data.receiveMaximum);
                if (data.receiveMaximum == 0) {
                    throw new Error(getPropertyText(id) + " must not be 0");
                }
                propertyLen -= 2;
                break;
            }

            case PropertyID.MaximumQoSID: {
                data.maximumQoS = PropertyDecoderOnlyOnce.toByte(dec, id, data.maximumQoS);
                if (data.maximumQoS != 0 && data.maximumQoS != 1) {
                    throw new Error(getPropertyText(id) + " wrong maximum Qos");
                }
                propertyLen--;
                break;
            }

            case PropertyID.RetainAvailableID: {
                data.retainAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.retainAvailable);
                propertyLen--;
                break;
            }

            case PropertyID.MaximumPacketSizeID: {
                data.maximumPacketSize = PropertyDecoderOnlyOnce.toUint32(dec, id, data.maximumPacketSize);
                if (data.maximumPacketSize == 0) {
                    throw new Error(getPropertyText(id) + " must not be 0");
                }

                propertyLen -= 4;
                break;
            }

            case PropertyID.AssignedClientIdentifierID: {
                data.assignedClientIdentifier = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.assignedClientIdentifier);
                propertyLen -= (data.assignedClientIdentifier.length + 2);
                break;
            }

            case PropertyID.TopicAliasMaximumID: {
                data.topicAliasMaximum = PropertyDecoderOnlyOnce.toUint16(dec, id, data.topicAliasMaximum);
                propertyLen -= 2;
                break;
            }

            case PropertyID.ReasonStringID: {
                data.reasonString = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.reasonString);
                propertyLen -= (data.reasonString.length + 2);
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

            case PropertyID.WildcardSubscriptionAvailableID: {
                data.wildcardSubscriptionAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.wildcardSubscriptionAvailable);
                propertyLen--;
                break;
            }

            case PropertyID.SubscriptionIdentifierAvailableID: {
                data.subscriptionIdentifierAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.subscriptionIdentifierAvailable);
                propertyLen--;
                break;
            }

            case PropertyID.SharedSubscriptionAvailableID: {
                data.sharedSubscriptionAvailable = PropertyDecoderOnlyOnce.toBool(dec, id, data.sharedSubscriptionAvailable);
                propertyLen--;
                break;
            }

            case PropertyID.ServerKeepAliveID: {
                data.serverKeepAlive = PropertyDecoderOnlyOnce.toUint16(dec, id, data.serverKeepAlive);
                propertyLen -= 2;
                break;
            }

            case PropertyID.ResponseInformationID: {
                data.responseInformation = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.responseInformation);
                propertyLen -= (data.responseInformation.length + 2);
                break;
            }

            case PropertyID.ServerReferenceID: {
                data.serverReference = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.serverReference);
                propertyLen -= (data.serverReference.length + 2);
                break;
            }

            case PropertyID.AuthenticationMethodID: {
                data.authenticationMethod = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.authenticationMethod);
                propertyLen -= (data.authenticationMethod.length + 2);
                break;
            }

            case PropertyID.AuthenticationDataID: {
                data.authenticationData = PropertyDecoderOnlyOnce.toBinaryData(dec, id, data.authenticationData);
                propertyLen -= (data.authenticationData.length + 2);
                break;
            }
            default:
                throw new DecoderError("CONNACK: wrong property with identifier " + id);
        }
    }

    return data;
}
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, encodedVarUint32Size, DataStreamDecoder, PropertyDecoderOnlyOnce} from "../utils/codec";
import {PacketType, PropertyID} from '../utils/constants';
import {DecoderError} from '../client/errors';

export type MQTTConnectProperties = {
    sessionExpiryInterval?: number;
    receiveMaximum?: number;
    maximumPacketSize?: number;
    topicAliasMaximum?: number;
    requestResponseInformation?: boolean;
    requestProblemInformation?: boolean;
    userProperty?: Map<string, string>;
    authenticationMethod?: string;
    authenticationData?: Uint8Array;
}

export type MQTTConnect = {
    cleanStart: boolean;
    keepAlive: number;

    properties?: MQTTConnectProperties;

    clientIdentifier?: string;
    userName?: string;
    password?: Uint8Array;
}

const MQTTProtocolName = new Uint8Array([0x4D, 0x51, 0x54, 0x54]);
const MQTTProtocolVersion = 0x05;

export function encodeConnectPacket(msg: MQTTConnect): Uint8Array | never {
    function propertyLength(): number {
        let propertyLen = 0;
        if (msg.properties) {
            propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.properties.sessionExpiryInterval);
            propertyLen += PropertySizeIfNotEmpty.fromUint16(msg.properties.receiveMaximum);
            propertyLen += PropertySizeIfNotEmpty.fromUint32(msg.properties.maximumPacketSize);
            propertyLen += PropertySizeIfNotEmpty.fromUint16(msg.properties.topicAliasMaximum);
            propertyLen += PropertySizeIfNotEmpty.fromBool(msg.properties.requestProblemInformation);
            propertyLen += PropertySizeIfNotEmpty.fromBool(msg.properties.requestResponseInformation);
            propertyLen += PropertySizeIfNotEmpty.fromUTF8StringPair(msg.properties.userProperty);
            propertyLen += PropertySizeIfNotEmpty.fromUTF8Str(msg.properties.authenticationMethod);
            propertyLen += PropertySizeIfNotEmpty.fromBinaryData(msg.properties.authenticationData);
        }

        return propertyLen;
    }

    function encodeProperties(enc: DataStreamEncoder, propertyLen: number): void | never {
        enc.encodeVarUint32(propertyLen);
        if (msg.properties) {
            PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.SessionExpiryIntervalID, msg.properties.sessionExpiryInterval);
            PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.ReceiveMaximumID, msg.properties.receiveMaximum);
            PropertyEncoderIfNotEmpty.fromUint32(enc, PropertyID.MaximumPacketSizeID, msg.properties.maximumPacketSize);
            PropertyEncoderIfNotEmpty.fromUint16(enc, PropertyID.TopicAliasMaximumID, msg.properties.topicAliasMaximum);
            PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.RequestProblemInfoID, msg.properties.requestProblemInformation);
            PropertyEncoderIfNotEmpty.fromBool(enc, PropertyID.RequestResponseInfoID, msg.properties.requestResponseInformation);
            PropertyEncoderIfNotEmpty.fromUTF8StringPair(enc, PropertyID.UserPropertyID, msg.properties.userProperty);
            PropertyEncoderIfNotEmpty.fromUTF8Str(enc, PropertyID.AuthenticationMethodID, msg.properties.authenticationMethod);
            PropertyEncoderIfNotEmpty.fromBinaryData(enc, PropertyID.AuthenticationDataID, msg.properties.authenticationData);
        }
    }

    const propertyLen = propertyLength();

    // protocol name, version(1), flags(1), keepalive(2), propertyLength
    let remainingLength = 2 + MQTTProtocolName.length + 1 + 1 + 2 + encodedVarUint32Size(propertyLen) + propertyLen;
    remainingLength += (2 + (msg.clientIdentifier ? msg.clientIdentifier.length : 0));

    let connectFlags = 0;
    if (msg.cleanStart) {
        connectFlags |= 0x02;
    }

    const userName = msg.userName;
    const password = msg.password;
    if (userName && userName.length != 0) {
        connectFlags |= 0x80;
        remainingLength += (2 + userName.length);
        if (password && password.length != 0) {
            connectFlags |= 0x40;
            remainingLength += (2 + password.length);
        }
    }

    const encoder = new DataStreamEncoder(remainingLength + 2); // fixed header length = 3, flags + remaining len(uint16)
    encoder.encodeByte(PacketType.CONNECT << 4);
    encoder.encodeVarUint32(remainingLength);

    // protocol name, version
    encoder.encodeBinaryData(MQTTProtocolName);
    encoder.encodeByte(MQTTProtocolVersion);

    // connect flags
    encoder.encodeByte(connectFlags);

    // encode KeepAlive
    encoder.encodeUint16(msg.keepAlive);

    // encode properties
    encodeProperties(encoder, propertyLen);

    // encode client identifier
    encoder.encodeUTF8String(msg.clientIdentifier ? msg.clientIdentifier : "");

    // encode username, password
    if (userName && userName.length != 0) {
        encoder.encodeUTF8String(userName);
        if (password && password.length != 0) {
            encoder.encodeBinaryData(password);
        }
    }
    return encoder.byteArray;
}

export function decodeConnectPacket(dec: DataStreamDecoder): MQTTConnect | never {
    const name = dec.decodeUTF8String();
    if (name !== "MQTT") {
        throw new Error("Invalid protocol name in CONNECT packet");
    }

    const version = dec.decodeByte();
    if (version != 0x05) {
        throw new Error("Invalid protocol version in CONNECT packet");
    }
    const connectFlag = dec.decodeByte();

    const cleanStart = (connectFlag & 0x02) > 0;
    const passwordFlag = (connectFlag & 0x40) > 0;
    const usernameFlag = (connectFlag & 0x80) > 0;

    const keepAlive = dec.decodeUint16();
    const data: MQTTConnect = {cleanStart: cleanStart, keepAlive: keepAlive};

    let propertyLen = dec.decodeVarUint32();
    if (propertyLen > 0) {
        data.properties = {};
    }
    while (propertyLen > 0 && data.properties) {
        const id = dec.decodeVarUint32();
        propertyLen--;
        switch (id) {
            case PropertyID.SessionExpiryIntervalID:
                data.properties.sessionExpiryInterval = PropertyDecoderOnlyOnce.toUint32(dec, id, data.properties.sessionExpiryInterval);
                propertyLen -= 4;
                break;
            case PropertyID.ReceiveMaximumID:
                data.properties.receiveMaximum = PropertyDecoderOnlyOnce.toUint16(dec, id, data.properties.receiveMaximum);
                propertyLen -= 2;
                break;
            case PropertyID.MaximumPacketSizeID:
                data.properties.maximumPacketSize = PropertyDecoderOnlyOnce.toUint32(dec, id, data.properties.maximumPacketSize);
                propertyLen -= 4;
                break;
            case PropertyID.TopicAliasMaximumID:
                data.properties.topicAliasMaximum = PropertyDecoderOnlyOnce.toUint16(dec, id, data.properties.topicAliasMaximum);
                propertyLen -= 2;
                break;
            case PropertyID.RequestProblemInfoID:
                data.properties.requestProblemInformation = PropertyDecoderOnlyOnce.toBool(dec, id, data.properties.requestProblemInformation);
                propertyLen -= 1;
                break;
            case PropertyID.RequestResponseInfoID:
                data.properties.requestResponseInformation = PropertyDecoderOnlyOnce.toBool(dec, id, data.properties.requestResponseInformation);
                propertyLen -= 1;
                break;
            case PropertyID.UserPropertyID: {
                if (!data.properties.userProperty) {
                    data.properties.userProperty = new Map<string, string>();
                }
                const {key, value} = dec.decodeUTF8StringPair();
                data.properties.userProperty.set(key, value);
                propertyLen -= (key.length + value.length + 4);
                break;
            }
            case PropertyID.AuthenticationMethodID:
                data.properties.authenticationMethod = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.properties.authenticationMethod);
                propertyLen -= (data.properties.authenticationMethod.length + 2);
                break;
            case PropertyID.AuthenticationDataID:
                data.properties.authenticationData = PropertyDecoderOnlyOnce.toBinaryData(dec, id, data.properties.authenticationData);
                propertyLen -= (data.properties.authenticationData.length + 2);
                break;
            default:
                throw new DecoderError("CONNECT: wrong property with identifier " + id);
        }
    }

    data.clientIdentifier = dec.decodeUTF8String();

    if (usernameFlag) {
        data.userName = dec.decodeUTF8String();
    }
    if (passwordFlag) {
        data.password = dec.decodeBinaryData();
    }

    return data;
}

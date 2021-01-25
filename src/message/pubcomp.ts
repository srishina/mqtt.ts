import {decodeMQTTPublishResponse, PublishResponsePacket} from "./packet";
import {PropertySizeIfNotEmpty, PropertyEncoderIfNotEmpty, DataStreamEncoder, DataStreamDecoder} from "../utils/codec";
import {PacketType, PropertyID, MQTTCommonReasonCode, getCommonReasonCodeName} from '../utils/constants';

export namespace MQTTPubCompReason {
    export enum Code {
        Success = MQTTCommonReasonCode.Success,
        PacketIdentifierNotFound = MQTTCommonReasonCode.PacketIdentifierNotFound,
    }

    export const Name = new Map<Code, string>([
        [Code.Success, getCommonReasonCodeName(MQTTCommonReasonCode.Success)],
        [Code.PacketIdentifierNotFound, getCommonReasonCodeName(MQTTCommonReasonCode.PacketIdentifierNotFound)],
    ]);
    export const Description = new Map<Code, string>([
        [Code.Success, "Packet Identifier released. Publication of QoS 2 message is complete."],
        [Code.PacketIdentifierNotFound, `The Packet Identifier is not known. This is not an error
                                        during recovery, but at other times indicates a mismatch 
                                        between the Session State on the Client and Server. `],
    ]);
}

export type MQTTPubComp = {
    reason: MQTTPubCompReason.Code;
    reasonString?: string;
    userProperty?: Map<string, string>;
}

export class MQTTPubCompPacket extends PublishResponsePacket {
    private msg: MQTTPubComp;
    constructor(pktID: number, msg: MQTTPubComp) {
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
        const byte0: number = (PacketType.PUBCOMP << 4);
        return this.buildWitHeaderFlag(byte0, this.msg.reason);
    }
}

export function decodePubCompPacket(byte0: number, dec: DataStreamDecoder): {pktID: number, pubcomp: MQTTPubComp} {
    const {pktID, result} = decodeMQTTPublishResponse(byte0, dec);
    return {
        pktID: pktID, pubcomp: {reason: result.reasonCode, reasonString: result.reasonString, userProperty: result.userProperty}
    };
}

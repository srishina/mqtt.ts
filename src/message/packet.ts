import {DecoderError} from '../client/errors'
import type {DataStreamDecoder} from '../utils/codec'
import { DataStreamEncoder, encodedVarUint32Size, PropertyDecoderOnlyOnce} from '../utils/codec'
import type {PacketType} from '../utils/constants'
import { PropertyID} from '../utils/constants'

export abstract class PacketWithID {
    id: number

    constructor(id: number) {
        this.id = id
    }

    abstract build(): Uint8Array | never
}

export abstract class PublishResponsePacket extends PacketWithID {
    constructor(pktID: number) {
        super(pktID)
    }

    protected abstract propertyLength(): number;
    protected abstract encodeProperties(encoder: DataStreamEncoder, propertyLen: number): void | never;
    protected abstract hasProperties(): boolean;

    buildWitHeaderFlag(byte0: number, reasonCode: number): Uint8Array | never {
        const propertyLen = this.propertyLength()

        let remainingLength = 2

        // The Reason Code and Property Length can be omitted
        // if the Reason Code is 0x00 (Success) 1849 and there are no Properties.
        // In this case the packet has a Remaining Length of 2.
        if (((reasonCode != 0x00) || this.hasProperties())) {
            remainingLength += (1 + propertyLen + encodedVarUint32Size(propertyLen))
        }

        const encoder = new DataStreamEncoder(remainingLength + 2) // fixed header length = 1,  remaining len(varuint32)

        encoder.encodeByte(byte0)

        encoder.encodeVarUint32(remainingLength)

        encoder.encodeUint16(this.id)

        if (remainingLength != 2) {
            encoder.encodeByte(reasonCode)
            this.encodeProperties(encoder, propertyLen)
        }

        return encoder.byteArray
    }

}

export type MQTTPublishResponse = {
    packetType: PacketType;
    reasonCode: number,
    reasonString?: string
    userProperty?: Map<string, string>;
};

export function decodeMQTTPublishResponse(byte0: number, dec: DataStreamDecoder): {pktID: number, result: MQTTPublishResponse} | never {
    const data: MQTTPublishResponse = {packetType: (byte0 >> 4), reasonCode: 0}

    const pktID = dec.decodeUint16()
    // we have to read reason code and properties only when the remaining length is
    // greater than 2
    if (dec.remainingLength() > 0) {
        data.reasonCode = dec.decodeByte()
        // read the properties only, if the Remaining Length is greater than or equal 4.
        // if the remaining length is 4, then the encoded property length is 0.
        if (dec.remainingLength() > 0) {
            let propertyLen = dec.decodeVarUint32()
            while (propertyLen > 0) {
                const id = dec.decodeVarUint32()
                propertyLen--
                switch (id) {
                    case PropertyID.ReasonStringID: {
                        data.reasonString = PropertyDecoderOnlyOnce.toUTF8Str(dec, id, data.reasonString)
                        propertyLen -= (data.reasonString.length + 2)
                        break
                    }

                    case PropertyID.UserPropertyID: {
                        if (!data.userProperty) {
                            data.userProperty = new Map<string, string>()
                        }
                        const {key, value} = dec.decodeUTF8StringPair()
                        data.userProperty.set(key, value)
                        propertyLen -= (key.length + value.length + 4)
                        break
                    }

                    default:
                        throw new DecoderError("SUBACK: wrong property with identifier " + id)
                }
            }
        }
    }

    return {pktID: pktID, result: data}
}

// e.g PINGRESP, PINGREQ
export function buildHeaderOnlyPacket(ptype: PacketType): Uint8Array | never {
    return new Uint8Array([ptype << 4, 0])
}

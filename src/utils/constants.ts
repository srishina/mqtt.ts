export enum PacketType {
    RESERVED = 0,
    CONNECT = 1,
    CONNACK = 2,
    PUBLISH = 3,
    PUBACK = 4,
    PUBREC = 5,
    PUBREL = 6,
    PUBCOMP = 7,
    SUBSCRIBE = 8,
    SUBACK = 9,
    UNSUBSCRIBE = 10,
    UNSUBACK = 11,
    PINGREQ = 12,
    PINGRESP = 13,
    DISCONNECT = 14,
    AUTH = 15,
}

export const MQTTPacketTypeName = new Map<PacketType, string>([
    [PacketType.CONNECT, "CONNECT"],
    [PacketType.CONNACK, "CONNACK"],
    [PacketType.PUBLISH, "PUBLISH"],
    [PacketType.PUBACK, "PUBACK"],
    [PacketType.PUBREC, "PUBREC"],
    [PacketType.PUBREL, "PUBREL"],
    [PacketType.PUBCOMP, "PUBCOMP"],
    [PacketType.SUBSCRIBE, "SUBSCRIBE"],
    [PacketType.SUBACK, "SUBACK"],
    [PacketType.UNSUBSCRIBE, "UNSUBSCRIBE"],
    [PacketType.UNSUBACK, "UNSUBACK"],
    [PacketType.PINGREQ, "PINGREQ"],
    [PacketType.PINGRESP, "PINGRESP"],
    [PacketType.DISCONNECT, "DISCONNECT"],
    [PacketType.AUTH, "AUTH"]
])

export enum MQTTCommonReasonCode {
    Success = 0x00, // CONNACK, PUBACK, PUBREC, PUBREL, PUBCOMP, UNSUBACK, AUTH
    NoMatchingSubscribers = 0x10, // PUBACK, PUBREC
    UnspecifiedError = 0x80, // CONNACK, PUBACK, PUBREC, SUBACK, UNSUBACK, DISCONNECT
    MalformedPacket = 0x81, // CONNACK, DISCONNECT
    ProtocolError = 0x82, // CONNACK, DISCONNECT
    ImplSpecificError = 0x83, // CONNACK, PUBACK, PUBREC, SUBACK, UNSUBACK, DISCONNECT
    NotAuthorized = 0x87, // CONNACK, PUBACK, PUBREC, SUBACK, UNSUBACK, DISCONNECT
    ServerBusy = 0x89, // CONNACK, DISCONNECT
    BadAuthMethod = 0x8C, // CONNACK, DISCONNECT
    TopicFilterInvalid = 0x8F, // SUBACK, UNSUBACK, DISCONNECT
    TopicNameInvalid = 0x90, // CONNACK, PUBACK, PUBREC, DISCONNECT
    PacketIdentifierInUse = 0x91, // PUBACK, SUBACK, UNSUBACK
    PacketIdentifierNotFound = 0x92, // PUBREL, PUBCOMP
    PacketTooLarge = 0x95, // CONNACK, PUBACK, PUBREC, DISCONNECT
    QuotaExceeded = 0x97, // PUBACK, PUBREC, SUBACK, DISCONNECT
    PayloadFormatInvalid = 0x99, // CONNACK, DISCONNECT
    RetainNotSupported = 0x9A, // CONNACK, DISCONNECT
    QoSNotSupported = 0x9B, // CONNACK, DISCONNECT
    UseAnotherServer = 0x9C, // CONNACK, DISCONNECT
    ServerMoved = 0x9D, // CONNACK, DISCONNECT
    SharedSubscriptionsNotSupported = 0x9E, // SUBACK, DISCONNECT
    ConnectionRateExceeded = 0x9F, // CONNACK, DISCONNECT
    SubscriptionIdsNotSupported = 0xA1, // SUBACK, DISCONNECT
    WildcardSubscriptionsNotSupported = 0xA2, // SUBACK, DISCONNECT
}

const MQTTCommonReasonCodeName = new Map<MQTTCommonReasonCode, string>([
    [MQTTCommonReasonCode.Success, "Success"],
    [MQTTCommonReasonCode.NoMatchingSubscribers, "No matching subscribers"],
    [MQTTCommonReasonCode.UnspecifiedError, "Unspecified error"],
    [MQTTCommonReasonCode.MalformedPacket, "Malformed Packet"],
    [MQTTCommonReasonCode.ProtocolError, "Protocol Error"],
    [MQTTCommonReasonCode.ImplSpecificError, "Implementation specific error"],
    [MQTTCommonReasonCode.NotAuthorized, "Not authorized"],
    [MQTTCommonReasonCode.ServerBusy, "Server busy"],
    [MQTTCommonReasonCode.BadAuthMethod, "Bad authentication method"],
    [MQTTCommonReasonCode.TopicFilterInvalid, "Topic Filter invalid"],
    [MQTTCommonReasonCode.TopicNameInvalid, "Topic Name invalid"],
    [MQTTCommonReasonCode.PacketIdentifierInUse, "Packet Identifier in use"],
    [MQTTCommonReasonCode.PacketIdentifierNotFound, "Packet Identifier not found"],
    [MQTTCommonReasonCode.PacketTooLarge, "Packet too large"],
    [MQTTCommonReasonCode.QuotaExceeded, "Quota exceeded"],
    [MQTTCommonReasonCode.PayloadFormatInvalid, "Payload format invalid"],
    [MQTTCommonReasonCode.RetainNotSupported, "Retain not supported"],
    [MQTTCommonReasonCode.QoSNotSupported, "QoS not supported"],
    [MQTTCommonReasonCode.UseAnotherServer, "Use another server"],
    [MQTTCommonReasonCode.ServerMoved, "Server moved"],
    [MQTTCommonReasonCode.SharedSubscriptionsNotSupported, "Shared Subscriptions not supported"],
    [MQTTCommonReasonCode.ConnectionRateExceeded, "Connection rate exceeded"],
    [MQTTCommonReasonCode.SubscriptionIdsNotSupported, "Subscription Identifiers not supported"],
    [MQTTCommonReasonCode.WildcardSubscriptionsNotSupported, "Wildcard Subscriptions not supported"],
])

export function getCommonReasonCodeName(code: MQTTCommonReasonCode): string {
    return MQTTCommonReasonCodeName.has(code) ? MQTTCommonReasonCodeName.get(code) as string : ""
}

export enum PropertyID {
    // PayloadFormatIndicatorID Payload format indicator
    PayloadFormatIndicatorID = 0x01,

    // MessageExpiryIntervalID Message expiry interval
    MessageExpiryIntervalID = 0x02,

    // ContentTypeID Content type
    ContentTypeID = 0x03,

    // ResponseTopic response topic
    ResponseTopicID = 0x08,

    // CorrelationDataID Correlation data
    CorrelationDataID = 0x09,

    // SubscriptionIdentifierID Subscription Identifier
    SubscriptionIdentifierID = 0x0B,

    // SessionExpiryIntervalID session expiry property  identifier
    SessionExpiryIntervalID = 0x11,

    // AssignedClientIdentifierID Assigned Client Identifier
    AssignedClientIdentifierID = 0x12,

    // ServerKeepAliveID Server Keep Alive
    ServerKeepAliveID = 0x13,

    // AuthenticationMethodID maximum packet size id
    AuthenticationMethodID = 0x15,

    // AuthenticationDataID maximum packet size id
    AuthenticationDataID = 0x16,

    // RequestProblemInfoID maximum packet size id
    RequestProblemInfoID = 0x17,

    // WillDelayIntervalID Will Delay Interval
    WillDelayIntervalID = 0x18,

    // RequestResponseInfoID maximum packet size id
    RequestResponseInfoID = 0x19,

    // ResponseInformationID Response Information
    ResponseInformationID = 0x1A,

    // ServerReferenceID Server Reference
    ServerReferenceID = 0x1C,

    // ReasonStringID Reason String
    ReasonStringID = 0x1F,

    // ReceiveMaximumID receive maximum id
    ReceiveMaximumID = 0x21,

    // TopicAliasMaximumID maximum packet size id
    TopicAliasMaximumID = 0x22,

    // TopicAliasID Topic Alias
    TopicAliasID = 0x23,

    // MaximumQoSID Maximum QoS
    MaximumQoSID = 0x24,

    // RetainAvailableID Retain Available
    RetainAvailableID = 0x25,

    // UserPropertyID User property id
    UserPropertyID = 0x26,

    // MaximumPacketSizeID maximum packet size id
    MaximumPacketSizeID = 0x27,

    // WildcardSubscriptionAvailableID Wildcard Subscription Available
    WildcardSubscriptionAvailableID = 0x28,

    // SubscriptionIdentifierAvailableID Subscription Identifier Available
    SubscriptionIdentifierAvailableID = 0x29,

    // SharedSubscriptionAvailableID Shared Subscription Available
    SharedSubscriptionAvailableID = 0x2A,
}

const MQTTPropertyText = new Map<PropertyID, string>([
    [PropertyID.PayloadFormatIndicatorID, "Payload format indicator"],
    [PropertyID.MessageExpiryIntervalID, "Message expiry interval"],
    [PropertyID.ContentTypeID, "Content type"],
    [PropertyID.ContentTypeID, "Content type"],
    [PropertyID.ResponseTopicID, "response topic"],
    [PropertyID.CorrelationDataID, "Correlation data"],
    [PropertyID.SubscriptionIdentifierID, "Subscription Identifier"],
    [PropertyID.SessionExpiryIntervalID, "Session Expiry Interval"],
    [PropertyID.AssignedClientIdentifierID, "Assigned Client Identifier"],
    [PropertyID.ServerKeepAliveID, "Server Keep Alive"],
    [PropertyID.AuthenticationMethodID, "Authentication Method"],
    [PropertyID.AuthenticationDataID, "Authentication Data"],
    [PropertyID.RequestProblemInfoID, "Request Problem Information"],
    [PropertyID.RequestResponseInfoID, "Request Response Information"],
    [PropertyID.WillDelayIntervalID, "Will Delay Interval"],
    [PropertyID.ResponseInformationID, "Response Information"],
    [PropertyID.ServerReferenceID, "Server Reference"],
    [PropertyID.ReasonStringID, "Reason String"],
    [PropertyID.ReceiveMaximumID, "Receive Maximum"],
    [PropertyID.TopicAliasMaximumID, "Topic Alias Maximum"],
    [PropertyID.TopicAliasID, "Topic Alias"],
    [PropertyID.MaximumQoSID, "Maximum QoS"],
    [PropertyID.RetainAvailableID, "Retain Available"],
    [PropertyID.UserPropertyID, "User Property"],
    [PropertyID.MaximumPacketSizeID, "Maximum Packet Size"],
    [PropertyID.WildcardSubscriptionAvailableID, "Wildcard Subscription Available"],
    [PropertyID.SubscriptionIdentifierAvailableID, "Subscription Identifier Available"],
    [PropertyID.SharedSubscriptionAvailableID, "Shared Subscription Available"],
])

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function getPropertyText(id: PropertyID): string {
    return MQTTPropertyText.get(id)!
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */

export type MQTTStatstics = {
    numBytesSent: number;
    numBytesReceived: number;
    totalPublishPktsSent: number;
    totalPublishPktsReceived: number;
}

export type LogEntry = {
    epochTSInMS: number;
    message: string;
}

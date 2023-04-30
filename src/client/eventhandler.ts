import type { MQTTConnAck } from '../message/connack'
import type { MQTTSubscribe, MQTTSubAck } from '../message/subscribe'
import type { LogEntry } from '../utils/constants'

export type ResubscribeResult = {
    suback?: MQTTSubAck;
    err?: Error;
}

export interface MessageEvents {
    'logs': (entry: LogEntry) => void
    'disconnected': (err: Error) => void
    'reconnecting': (str: string) => void
    'reconnected': (result: MQTTConnAck) => void
    'resubscription': (subscribe: MQTTSubscribe, result: ResubscribeResult) => void
}

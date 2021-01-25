import {MQTTConnAck} from "../message/connack";
import {LogEntry} from "../utils/constants";

export interface MessageEvents {
    "logs": (entry: LogEntry) => void;
    "disconnected": (err: Error) => void;
    "reconnecting": (str: string) => void;
    "reconnected": (result: MQTTConnAck) => void;
}

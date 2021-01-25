import {MQTTDisconnectReason} from './../message/disconnect';

export class ServerDisconnectedError extends Error {
    private reason: MQTTDisconnectReason;
    constructor(reason: MQTTDisconnectReason) {
        super(`Error code: ${reason.getCode()} Name: ${reason.getName()}`);
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        this.name = ServerDisconnectedError.name; // stack traces display correctly now
        this.reason = reason;
    }

    getMessageWithDescription(): string {
        return `${this.message} Desc: ${this.reason.getDescription()}`;
    }
}

export class DecoderError extends Error {
    constructor(msg: string) {
        super(msg);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = DecoderError.name;
    }
}

export class ServerSessionContinuityNotAvailable extends Error {
    constructor() {
        super("Session does not support session continuity");
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = DecoderError.name;
    }
}

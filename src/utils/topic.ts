'use strict';
/** @internal */
export function isPublishTopicValid(topic: string): boolean {
    if (topic.length > 65535) {
        return false;
    }
    const restricted = "+#";
    return !topic.split("").some(ch => restricted.includes(ch));
}

export function isSubscribeTopicValid(topic: string): boolean {
    if (topic.length == 0) {
        return false;
    }

    if (topic.length > 65535) {
        return false;
    }

    let prevCh = '';
    for (let i = 0; i < topic.length; i++) {
        const ch = topic[i];
        if (ch == '+') {
            if (((i != 0) && (prevCh != '/')) || ((i < (topic.length - 1)) && (topic[i + 1] != '/'))) {
                return false;
            }
        } else if (ch == '#') {
            if (((i != 0) && (prevCh != '/')) || (i < (topic.length - 1))) {
                return false;
            }
        }
        prevCh = ch;
    }

    return true;
}

export interface Observer<T> {
    onData: (value: T) => void;
}

export class Node<T> {
    private part?: string;
    private parent?: Node<T>;
    private _childs: Map<string, Node<T>>;
    private _observer: Observer<T> | undefined;

    constructor(part?: string, parent?: Node<T>) {
        this.part = part;
        this.parent = parent;
        this._childs = new Map<string, Node<T>>();
    }

    get observer(): Observer<T> | undefined {
        return this._observer;
    }

    addObserver(observer: Observer<T>): void | never {
        this._observer = observer;
    }

    removeObserver(): void | never {
        this._observer = undefined;
    }

    hasObserver(): boolean {
        return this._observer ? true : false;
    }

    addChildren(part: string, child: Node<T>): void {
        this._childs.set(part, child);
    }

    getChildren(part: string): Node<T> | undefined {
        return this._childs.get(part);
    }

    remove(): void {
        if (!this.parent || !this.part) {
            return;
        }

        this._childs.delete(this.part);

        if (!this.parent.hasObserver() && !this.parent.hasChildren()) {
            this.parent.remove();
        }
    }

    hasChildren(): boolean {
        return (this._childs.size != 0);
    }
}

export class TopicMatcher<T> {
    private root: Node<T>;

    constructor() {
        this.root = new Node<T>();
    }

    public subscribe(topic: string, subscriber: Observer<T>): void | never {
        if (!isSubscribeTopicValid(topic)) {
            throw new Error("Subscribe topic is invalid");
        }

        let cur = this.root;

        topic.split('/').forEach(function(el) {
            let child = cur.getChildren(el);
            if (!child) {
                child = new Node(el, cur);
                cur.addChildren(el, child);
            }
            cur = child;
        });

        cur.addObserver(subscriber);
    }

    public unsubscribe(topic: string): void | never {
        if (!isSubscribeTopicValid(topic)) {
            throw new Error("Unsubscribe topic is invalid");
        }

        let cur = this.root;

        topic.split('/').forEach(function(el) {
            const child = cur.getChildren(el);
            if (!child) {
                return;
            }
            cur = child;
        });

        cur.removeObserver();

        // check wheher we have other subscribers or having children
        if (!cur.hasObserver() && !cur.hasChildren()) {
            cur.remove();
        }
    }

    public match(topic: string): Observer<T>[] | never {
        if (!isPublishTopicValid(topic)) {
            throw new Error("Publish topic is invalid");
        }

        return this.matchInternal(topic.split("/"), this.root);
    }

    private matchInternal(parts: string[], node: Node<T>): Observer<T>[] {
        const subscribers: Observer<T>[] = [];
        // "foo/#” also matches the singular "foo", since # includes the parent level.
        let child = node.getChildren("#");
        if (child && child.observer) {
            subscribers.push(child.observer);
        }

        if (parts.length == 0 && node.observer) {
            subscribers.push(node.observer);
            return subscribers;
        }

        child = node.getChildren("+");
        if (child) {
            // found +, check it is the last part
            // from MQTTv5 spec
            // e.g “sport/tennis/+” matches “sport/tennis/player1” and “sport/tennis/player2”,
            // but not “sport/tennis/player1/ranking”.
            if (parts.length == 1) {
                if (child.observer) {
                    subscribers.push(child.observer);
                }
                subscribers.push(...this.matchInternal(parts, child));
            } else {
                subscribers.push(...this.matchInternal(parts.slice(1), child));
            }
        }

        child = node.getChildren(parts[0]);
        if (child) {
            subscribers.push(...this.matchInternal(parts.slice(1), child));
        }

        return subscribers;
    }
}

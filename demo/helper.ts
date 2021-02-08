import * as mqttv5 from './../dist.browser/index.js';

let mqttClient: mqttv5.MQTTClient = undefined;

let statisticsTimer: ReturnType<typeof setInterval>;

$(function () {
    $("#connect-btn").on('click', connect);
    $("#subscribe-btn").on('click', subscribe);
    $("#unsubscribe-btn").on('click', unsubscribe);
    $("#publish-btn").on('click', publish);

    $("#log-msg").on('click', '.clickable-row', () => {
        $(".row-highlight").removeClass("row-highlight");
        $(this).addClass("row-highlight");
    });

    $("#log-msg").on('click', '.clickable-row', () => {
        $(".row-highlight").removeClass("row-highlight");
        $(this).addClass("row-highlight");
    });

    $("#connection-collapse").on("shown.bs.collapse", () => {
        const el = (<HTMLInputElement>document.getElementById("host-input"));
        putCursorAtEnd(el);
    });

    $("#subscribe-collapse").on("shown.bs.collapse", () => {
        const el = (<HTMLInputElement>document.getElementById("subscribe-topic-input"));
        putCursorAtEnd(el);
    });

    $("#unsubscribe-collapse").on("shown.bs.collapse", () => {
        const el = (<HTMLInputElement>document.getElementById("unsubscribe-topic-input"));
        putCursorAtEnd(el);
    });

    $("#publish-collapse").on("shown.bs.collapse", () => {
        const el = (<HTMLInputElement>document.getElementById("publish-topic-input"));
        putCursorAtEnd(el);
    });

    logMessage("mqttv5 client is setup and started...")
});

function connect(): void {
    if (mqttClient) {
        clearInterval(statisticsTimer);
        mqttClient.disconnect();
        mqttClient = undefined;
        (<HTMLInputElement>document.querySelector('#connect-btn')).textContent = "Connect";
    } else {
        onConnect();
        (<HTMLInputElement>document.querySelector('#connect-btn')).textContent = "Disconnect";
    }
}

function logPublishMessages(table: HTMLTableElement, msg: mqttv5.MQTTPublish): void {
    const tableRow = table.tBodies[0].insertRow();
    const rowCell = tableRow.insertCell();
    const rowCell2 = tableRow.insertCell();
    const rowCell3 = tableRow.insertCell();

    rowCell.appendChild(document.createTextNode(msg.topic));
    rowCell2.appendChild(document.createTextNode(msg.qos.toString()));
    rowCell3.appendChild(document.createTextNode(mqttv5.getPayloadAsString(msg.payload)));
}

class DemoSubscriber implements mqttv5.Subscriber {
    onData(msg: mqttv5.MQTTPublish): void {
        console.log("message receved " + msg);
        // do nothing
        logPublishMessages((<HTMLTableElement>document.getElementById("recvd-msg-table")), msg);
    }
}

const subscriber = new DemoSubscriber();

function subscribe(): void {
    const topic = (<HTMLInputElement>document.getElementById("subscribe-topic-input")).value;
    const qos = (<HTMLInputElement>document.getElementById("subscribe-qos-input")).value;
    const s: mqttv5.MQTTSubscription = {topicFilter: topic, qos: parseInt(qos)};
    const result = mqttClient.subscribe({subscriptions: [s]}, subscriber);
    result.then((suback: mqttv5.MQTTSubAck) => {
        logMessage("SUBSCRIBE successful");
        addSubscribedTopic(topic);
    },
        (reason) => {
            logMessage("SUBSCRIBE failed " + reason);
        });
}

function unsubscribe(): void {
    const topic = (<HTMLInputElement>document.getElementById("unsubscribe-topic-input")).value;
    let unsubscribe: mqttv5.MQTTUnsubscribe = {topicFilters: []};
    if (topic.length > 0) {
        unsubscribe = {topicFilters: [topic]};
    } else {
        const selected = $("#subscriptions-input").find("option:selected");
        if (selected.length > 0) {
            selected.each((idx, val) => {
                unsubscribe.topicFilters.push((<HTMLOptionElement>val).value);
            });
        }
    }

    if (unsubscribe.topicFilters.length > 0) {
        const result = mqttClient.unsubscribe(unsubscribe);
        result.then((client: mqttv5.MQTTUnsubAck) => {
            logMessage("UNSUBSCRIBE successful");
            removeSubscribedTopic(unsubscribe.topicFilters);
        },
            (reason) => {
                logMessage("UNSUBSCRIBE failed " + reason);
            });
    }
}

function publish(): void {
    const topic = (<HTMLInputElement>document.getElementById("publish-topic-input")).value;
    const qos = (<HTMLInputElement>document.getElementById("publish-qos-input")).value;
    const payload = (<HTMLInputElement>document.getElementById("publish-msg-input")).value;


    const mqttPublish: mqttv5.MQTTPublish = {topic: topic, qos: parseInt(qos), payload: payload};

    const result = mqttClient.publish(mqttPublish);
    result.then(() => {
        logMessage("PUBLISH successful");
        logPublishMessages((<HTMLTableElement>document.getElementById("sent-msg-table")), mqttPublish);
    },
        (reason) => {
            logMessage("PUBLISH failed " + reason);
        });
}

function onConnected(uri: string) {
    const el = document.getElementById("connection-card-status-text");
    el.innerHTML = `- Connected to ${uri}`;
}

function onConnectionError(err?: any) {
    const el = document.getElementById("connection-card-status-text");
    el.innerHTML = `- Disconnected with ${err.message}`;
}

function onConnect(): void {
    const host = (<HTMLInputElement>document.getElementById("host-input")).value;
    const port = (<HTMLInputElement>document.getElementById("port-input")).value;
    const path = (<HTMLInputElement>document.getElementById("path-input")).value;

    const url = "ws://" + host + ":" + parseInt(port) + path;

    const clientID = (<HTMLInputElement>document.getElementById("client-id-input")).value;

    const uname = (<HTMLInputElement>document.getElementById("uname-input")).value;
    const pwd = (<HTMLInputElement>document.getElementById("pwd-input")).value;

    const keepAlive = (<HTMLInputElement>document.getElementById("keep-alive-input")).value;
    const cleanSesssion = (<HTMLInputElement>document.getElementById("clean-session-input")).checked;

    const mqttConnect: mqttv5.MQTTConnect = {keepAlive: parseInt(keepAlive), cleanStart: cleanSesssion};
    if (clientID.length > 0) {
        mqttConnect.clientIdentifier = clientID;
    }

    if (uname.length > 0) {
        mqttConnect.userName = uname;
    }

    if (pwd.length > 0) {
        mqttConnect.password = mqttv5.getPayloadAsArray(pwd);
    }

    mqttClient = new mqttv5.MQTTClient(url)
    // setup event handlers
    mqttClient.on("logs", (entry: mqttv5.LogEntry) => {
        logMessage(entry.message);
    });

    mqttClient.on("disconnected", (error: Error) => {
        onConnectionError(error);
    });

    mqttClient.on("reconnecting", (msg: string) => {
        logMessage(msg);
    });

    mqttClient.on("reconnected", (result: mqttv5.MQTTConnAck) => {
        onConnected(url);
    });

    const result = mqttClient.connect(mqttConnect, 2000);
    result.then((connack: mqttv5.MQTTConnAck) => {
        onConnected(url);

        statisticsTimer = setInterval(() => {
            printStatistics()
        }, 10 * 1000)

    }, (reason) => {
        onConnectionError(reason);
    });
}

function printStatistics(): void {
    let stats = mqttClient.getStatistics();
    logMessage(`Bytes sent: ${stats.numBytesSent} Bytes received: ${stats.numBytesReceived} 
                    Total Publish pkt sent: ${stats.totalPublishPktsSent} Total Publish pkt recvd: ${stats.totalPublishPktsReceived}`);
}

function logMessage(msg: string): void {
    $('#log-msg').append(
        $('<div/>')
            .addClass("col-lg-12 clickable-row")
            .append("<span/>")
            .text(msg).append("<hr>")
    );
}

function getTimeStamp(): string {
    const now = new Date();
    return ('[' + (now.getMonth() + 1) + '/' +
        (now.getDate()) + '/' +
        now.getFullYear() + " " +
        now.getHours() + ':' +
        ((now.getMinutes() < 10)
            ? ("0" + now.getMinutes())
            : (now.getMinutes())) + ':' +
        ((now.getSeconds() < 10)
            ? ("0" + now.getSeconds())
            : (now.getSeconds())) + ']');
}

function putCursorAtEnd(el: HTMLInputElement): void {
    const hostInputLen = el.value.length;
    el.focus();
    el.setSelectionRange(hostInputLen, hostInputLen);
}

function addSubscribedTopic(topic: string): void {
    // item already present, dont add again
    const childs = $("#subscriptions-input").children('option');
    for (let i = 0; i < childs.length; ++i) {
        if (childs[i].innerHTML == topic) {
            return;
        }
    }

    const subscriptionsEl = $("#subscriptions-input");
    var opt = $('<option/>');
    opt.attr({'value': topic}).text(topic);
    subscriptionsEl.append(opt);

    changeSelectElementTitleIfNeeded(subscriptionsEl);

    $('#subscriptions-input').selectpicker('refresh');
}

function removeSubscribedTopic(topic: string[]): void {
    $('#subscriptions-input').selectpicker('val', topic);
    removeSelected();
}

function removeSelected(): void {
    $('#subscriptions-input option:selected').remove();
    const subscriptionsEl = $("#subscriptions-input");
    changeSelectElementTitleIfNeeded(subscriptionsEl);
    subscriptionsEl.selectpicker('refresh');
}

function changeSelectElementTitleIfNeeded(el: JQuery<HTMLElement>): void {
    const optionsLen = el.children('option').length;
    if (optionsLen == 1) {
        el.selectpicker({title: 'Select a subscription'})
    } else if (optionsLen == 0) {
        el.selectpicker({title: 'No subscriptions available...'})
    }
}

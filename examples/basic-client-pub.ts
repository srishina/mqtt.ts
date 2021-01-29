import * as yargs from 'yargs'
import * as mqttv5 from './../dist/index.js';

const opts = yargs
    .usage("Usage: ts-node $0 -b <broker> [-k <keep-alive>] [-c <clean-start>] -t <topic> -p <payload-str> [-q <qos>]")
    .option({
        broker: {alias: "b", describe: "MQTTv5 broker", type: "string", demandOption: true},
        keepAlive: {alias: "k", describe: "Keep alive in secs, default: 0 (turn off keep alive mechanism)", type: "number", demandOption: false, default: 0},
        cleanStart: {alias: "c", describe: "Clean start", type: "boolean", demandOption: false, default: true},
        topic: {alias: "t", describe: "Topic", type: "string", demandOption: true},
        payload: {alias: "p", describe: "Payload", type: "string", demandOption: true},
        qos: {alias: "q", describe: "QoS", type: "number", demandOption: false, default: 0},
    })
    .argv;

async function run() {
    const mqttConnect: mqttv5.MQTTConnect = {keepAlive: opts.keepAlive, cleanStart: opts.cleanStart};
    const client = await mqttv5.connect(opts.broker, mqttConnect, 2000).catch(err => {
        console.log("Failed to connect, error: " + err);
    });
    if (client) {
        await client.publish({topic: opts.topic, payload: opts.payload, qos: opts.qos}).catch(err => {
            console.log("Failed to publish, error: " + err);
        });
        client.disconnect();
    }
}

run();

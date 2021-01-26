import * as yargs from 'yargs'
import * as mqttv5 from './../dist/index.js';

const opts = yargs
    .usage("Usage: ts-node $0 -b <broker>")
    .option({
        broker: {alias: "b", describe: "MQTTv5 broker", type: "string", demandOption: true},
        keepAlive: {alias: "k", describe: "Keep alive", type: "number", demandOption: false, default: 0},
        cleanStart: {alias: "c", describe: "Clean start", type: "boolean", demandOption: false, default: true},
    })
    .argv;

async function run() {
    return new Promise<any>(async (resolve, reject) => {
        const mqttConnect: mqttv5.MQTTConnect = {keepAlive: opts.keepAlive, cleanStart: opts.cleanStart};
        const result = await mqttv5.connect(opts.broker, mqttConnect, 2000).catch(err => {
            console.log("Failed to connect, error: " + err);
        });
        if (result) {
            result.disconnect();
        }
    });
}

run();

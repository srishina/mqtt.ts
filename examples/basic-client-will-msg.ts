import * as yargs from 'yargs'
import * as mqttv5 from './../dist/index.js'

const opts = yargs
    .usage('Usage: ts-node $0 -b <broker> [-k <keep-alive>] [-c <clean-start>] -t <topic> [-q <qos>]')
    .option({
        broker: {alias: 'b', describe: 'MQTTv5 broker', type: 'string', demandOption: true},
        keepAlive: {alias: 'k', describe: 'Keep alive', type: 'number', demandOption: false, default: 0},
        cleanStart: {alias: 'c', describe: 'Clean start', type: 'boolean', demandOption: false, default: true},
        willTopic: {alias: 't', describe: 'Will Topic', type: 'string', demandOption: true},
        willPayload: {alias: 'p', describe: 'Will Payload', type: 'string', demandOption: true},
        topicFilter: {alias: 's', describe: 'Topic filter', type: 'string', demandOption: true},
    })
    .argv

class TestSubscriber implements mqttv5.Subscriber {
    public promise: Promise<mqttv5.MQTTPublish>;
    private resolveSelf: (value: mqttv5.MQTTPublish | PromiseLike<mqttv5.MQTTPublish>) => void;
    constructor() {
        this.promise = new Promise<mqttv5.MQTTPublish>((resolve) => {
            this.resolveSelf = resolve
        })
    }

    onData(msg: mqttv5.MQTTPublish): void {
        this.resolveSelf(msg)
    }
}

async function run() {
    const mqttConnect: mqttv5.MQTTConnect = {
        keepAlive: opts.keepAlive, cleanStart: opts.cleanStart,
        willProperties: {willDelayInterval: 1}, willTopic: opts.willTopic, willPayload: opts.willPayload
    }
    const willClient = new mqttv5.MQTTClient(opts.broker, {timeout: 2000})
    await willClient.connect(mqttConnect).catch(err => {
        console.log('Failed to connect, error: ' + err)
    })
    if (willClient) {
        try {
            const client2 = new mqttv5.MQTTClient(opts.broker, {timeout: 2000})
            await client2.connect({keepAlive: opts.keepAlive, cleanStart: opts.cleanStart}).catch(err => {
                console.log('Failed to connect, error: ' + err)
            })

            if (client2) {
                const subscriber = new TestSubscriber()
                const s: mqttv5.MQTTSubscription = {topicFilter: opts.topicFilter}
                const suback = await client2.subscribe({subscriptions: [s]}, subscriber)
                if (suback.reasonCodes.length == 1) {
                    console.log(`Requested QoS: ${opts.qos}, Granted QoS: ${suback.reasonCodes[0]}`)
                    switch (suback.reasonCodes[0]) {
                        case mqttv5.MQTTSubAckReason.Code.GrantedQoS0:
                        case mqttv5.MQTTSubAckReason.Code.GrantedQoS1:
                        case mqttv5.MQTTSubAckReason.Code.GrantedQoS2:
                            break
                        default:
                            throw new Error(`Failed to subscribe, reason code: ${suback.reasonCodes[0]}, disconnecting...`)
                    }
                }
                // Disconnect client
                willClient.disconnect({reasonCode: mqttv5.MQTTDisconnectReason.Code.DisconnectWithWillMessage})
                const willMsg = await subscriber.promise
                console.log(`Will Message received - Topic: ${willMsg.topic} Payload: ${mqttv5.getPayloadAsString(willMsg.payload)} QoS: ${willMsg.qos} DUP: ${willMsg.dup}`)
                // send unsubscribe and disconnect
                // eslint-disable-next-line
                const unsuback = await client2.unsubscribe({topicFilters: ['subu/test/#']}).catch((err) => {
                    console.log('Failed to unsubscribe, error: ' + err)
                })
                client2.disconnect()
                console.log('Disconnected...')
            }
        }
        catch (e) {
            console.log(`Error ${e}, disconnecting...`)
            willClient.disconnect()
        }
    }
}

run()

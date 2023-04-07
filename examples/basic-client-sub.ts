import * as yargs from 'yargs'
import * as mqttv5 from './../dist/index.js'

const opts = yargs
    .usage('Usage: ts-node $0 -b <broker> [-k <keep-alive>] [-c <clean-start>] -t <topic> [-q <qos>]')
    .option({
        broker: {alias: 'b', describe: 'MQTTv5 broker', type: 'string', demandOption: true},
        keepAlive: {alias: 'k', describe: 'Keep alive', type: 'number', demandOption: false, default: 0},
        cleanStart: {alias: 'c', describe: 'Clean start', type: 'boolean', demandOption: false, default: true},
        topicFilter: {alias: 't', describe: 'Topic filter', type: 'string', demandOption: true},
        qos: {alias: 'q', describe: 'QoS', type: 'number', demandOption: false, default: 2},
    })
    .argv

class TestSubscriber implements mqttv5.Subscriber {
    onData(msg: mqttv5.MQTTPublish): void {
        console.log(`Topic: ${msg.topic} Payload: ${mqttv5.getPayloadAsString(msg.payload)} QoS: ${msg.qos} DUP: ${msg.dup}`)
    }
}
async function run() {
    const mqttConnect: mqttv5.MQTTConnect = {keepAlive: opts.keepAlive, cleanStart: opts.cleanStart}
    const client = new mqttv5.MQTTClient(opts.broker, {timeout: 2000})
    // eslint-disable-next-line
    const connack = await client.connect(mqttConnect).catch(err => {
        console.log('Failed to connect, error: ' + err)
    })
    if (client) {
        console.log('Press Ctrl-C to quit!')
        try {
            const s: mqttv5.MQTTSubscription = {topicFilter: opts.topicFilter, qos: opts.qos}
            const suback = await client.subscribe({subscriptions: [s]}, new TestSubscriber())
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
            process.on('SIGINT', async () => {
                console.log('Caught interrupt signal')
                // send unsubscribe and disconnect
                // eslint-disable-next-line
                const unsuback = await client.unsubscribe({topicFilters: ['subu/test/#']}).catch((err) => {
                    console.log('Failed to unsubscribe, error: ' + err)
                })
                client.disconnect()
                console.log('Disconnected...')
            })

        }
        catch (e) {
            console.log(`Error ${e}, disconnecting...`)
            client.disconnect()
        }
    }
}

run()

# mqtt.ts
MQTTv5 client

mqtt-ts is a client library for the MQTTv5 protocol, written in typescript for node and browser. The library uses promises and async/wait patterns. 

The library uses websocket as network transport, no other network transports are supported.


# How to build the library and try out the demo/example?
The below command produces necessary artifacts to run in browser and node environment. A browser demo with UI has been provided in demo folder.

```bash
npm install
npm run build
```

To run in browser:
```bash
cd ./dist.browser.demo
```

Run the index.html in a browser. The UI has the possibility to connect to a broker, subscribe/publish to MQTT messages or try out MQTTv5 properties.
The demo uses bootstrap 4 and jquery as dependent components.

Try out the examples:
```bash
cd ./examples
```

Connect to a broker(basic client):
```bash
ts-node basic-client.ts -b ws://mqtt.eclipseprojects.io:80/mqtt -k 120 -c true
```
Publish a message:
```bash
ts-node basic-client-pub.ts -b ws://mqtt.eclipseprojects.io:80/mqtt -k 120 -t foo/world/1 -p "Welcome" (Default QoS: 0 - if not given)
```
Subscribe to a message:
```bash
ts-node basic-client-sub.ts -b ws://mqtt.eclipseprojects.io:80/mqtt -k 120 -t foo/world/# (Default QoS: 0 - if not given)
```
Will message:
```bash
ts-node basic-client-will-msg.ts -b ws://mqtt.eclipseprojects.io:80/mqtt -k 120 -t foo/will/1 -p "The will message" -s foo/will/#
```

# How to use Topic alias?
MQTT v5 supports a new feature named topic alias and the client library supports it.

In order to know whether the broker supports topic aliases, inspect the CONNACK packet from the MQTT CONNECT response.

Please use a real broker address instead of testURL to try out the below.

```typescript
const mqttClient = new MQTTClient(testURL, {timeout: 2000});
const connack = await mqttClient.connect({cleanStart: true, keepAlive: 0});
if (connAck.topicAliasMaximum && connAck.topicAliasMaximum > 0) {
    // broker supports topic alias and the value of connAck.topicAliasMaximum indicates
    // the highest value the broker accept as a topic alias sent by the client.
    // 3.2.2.3.8 Topic Alias Maximum in MQTTv5 spec
}
// ...
```

In order to use the topic alias,

```typescript
const mqttClient = new MQTTClient(testURL, {timeout: 2000});
const connack = await mqttClient.connect({cleanStart: true, keepAlive: 0});

const payloads: string[] = ["Hello World!", "Welcome!", "Willkommen!"];
await mqttClient.publish({topic: 'foo/test/1', topicAlias: 2, payload: payloads[1], qos: 1});
// From this point onwards, "foo/test/1" can be used with an alias 2
await mqttClient.publish({topic: '', topicAlias: 2, payload: payloads[2]});
// ...
```
Note: The topic alias can be changed. Before changing, it is important that, there are no pending requests with the topic alias.

# How the network reconnect is handled in the library?

The client library supports reconnecting and automatically resubscribe / publish the pending messages.

MQTTv5 supports the possibility to set whether the session that is initiated with the broker should be clean or a continuation of the last session. In the later case, the session unique identifier is used. The specification also provides an extra property through which the client or the broker can decide how long a session should be kept. The client can set a session expiry interval. However, if the broker specifies a session expiry interval then that value takes precedence. If the client or broker does not specify session expiry interval then the session state is lost when the network connection is dropped.

So in summary, clean start + the session expiry interval + the CONNACK response from the broker determines how the client reconnects.

The library operates as below:

If the network connection is dropped, the library tries to reconnect with the broker with the CONNECT packet set by client. At the moment, the library does not provide a mechanism to override the CONNECT packet. Based on the broker response the client will perform one of the below.

1. If the broker still has the session state, then the pending messages will be send, which can also include partial PUBLISH messages with QoS 2. No resubscription is needed as broker has the subscriptions.
2. If the broker has no session state, then the client library resubscribes to the already subscribed topics and send pending messages. For QoS 1 & 2 the library restarts the publish flow again. Note that, in this scenario the resubscription may fail and the client will be notified of the status of the resubscription.

Connection retry uses exponential backoff with jitter. 
```typescript
const mqttClient = new MQTTClient(testURL, {timeout: 2000, initialReconnectDelay: 1000, maxReconnectDelay: 32000, jitter: 0.3});

initialReconnectDelay & maxReconnectDelay are in ms.

please see Options for more information
```

# Network state changes:
The client can subscribe to network state changes.

```typescript
const mqttClient = new MQTTClient(testURL, {timeout: 2000});
const connack = await mqttClient.connect({cleanStart: true, keepAlive: 0});

mqttClient.on("disconnected", (error: Error) => {
    // disconnected
});

mqttClient.on("reconnecting", (msg: string) => {
    // reconnect started
});

mqttClient.on("reconnected", (result: mqttv5.MQTTConnAck) => {
    // reconnection successful
});
// ...
```

# Network statistics such as the number of bytes sent, received etc..:
```typescript
const mqttClient = new MQTTClient(testURL, {timeout: 2000});
const connack = await mqttClient.connect({cleanStart: true, keepAlive: 0});
// This method can be called periodically to know the network statistics
let stats = mqttClient.getStatistics();
logMessage(`Bytes sent: ${stats.numBytesSent} Bytes received: ${stats.numBytesReceived}
                Total Publish pkt sent: ${stats.totalPublishPktsSent} Total Publish pkt recvd: ${stats.totalPublishPktsReceived}`);
// ...
```
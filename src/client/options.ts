export type Options = {
    // Connect timeout in ms, includes network & protocol connect
    // default 2000ms
    timeout: number
    // uses exponential backoff
    // in ms, default: 1000ms
    initialReconnectDelay: number;
    // in ms, default: 32000ms
    // once this value is reached, the backoff time will not be increased
    maxReconnectDelay: number;
    // the value is added to get randomness to the retry delay
    // 0-1 inclusive
    jitter: number;
};

import type { Observer} from './topic'
import {isPublishTopicValid, isSubscribeTopicValid, TopicMatcher} from './topic'
import * as chai from 'chai'

const expect = chai.expect

const emittingValue = 1024
type Subscriber = Observer<number>;
class emptyTestSubscriber implements Subscriber {
    onData(value: number): void {
        expect(value).to.equal(emittingValue)
    }
}

describe('MQTT topic tests', () => {

    it('valid publish topics', () => {
        const validPublishTopics = [
            'pub/topic',
            'pub//topic',
            'pub/ /topic',
        ]

        validPublishTopics.forEach(function(element) {
            expect(isPublishTopicValid(element)).to.be.true
        })
    })

    it('invalid publish topics', () => {
        const invalidPublishTopics = [
            '+pub/topic',
            'pub+/topic',
            'pub/+topic',
            'pub/topic+',
            'pub/topic/+',
            '#pub/topic',
            'pub#/topic',
            'pub/#topic',
            'pub/topic#',
            'pub/topic/#',
            '+/pub/topic',
        ]

        invalidPublishTopics.forEach(function(element) {
            expect(isPublishTopicValid(element)).to.be.false
        })
    })

    it('valid subscribe topics', () => {
        const validSubscribeTopics = [
            'sub/topic',
            'sub//topic',
            'sub/ /topic',
            'sub/+/topic',
            '+/+/+',
            '+',
            'sub/topic/#',
            'sub//topic/#',
            'sub/ /topic/#',
            'sub/+/topic/#',
            '+/+/+/#',
            '#',
            '/#',
            'sub/topic/+/#',
        ]

        validSubscribeTopics.forEach(function(element) {
            expect(isSubscribeTopicValid(element)).to.be.true
        })
    })

    it('invalid subscribe topics', () => {
        const invalidSubscribeTopics = [
            '+sub/topic',
            'sub+/topic',
            'sub/+topic',
            'sub/topic+',
            '#sub/topic',
            'sub#/topic',
            'sub/#topic',
            'sub/topic#',
            '#/sub/topic',
            '',
        ]

        invalidSubscribeTopics.forEach(function(element) {
            expect(isSubscribeTopicValid(element)).to.be.false
        })
    })

    it('Topic successful matches', () => {
        const matchHelper = function(subtopic: string, topic: string) {
            const matcher = new TopicMatcher<number>()
            try {
                const tSubscriber = new emptyTestSubscriber()
                matcher.subscribe(subtopic, tSubscriber)
                const subscribers = matcher.match(topic)
                expect(subscribers.length).to.equal(1)
                subscribers[0].onData(emittingValue)
            } catch (e) {
                expect.fail('exception thrown' + e)
            }
        }

        matchHelper('foo/#', 'foo/')
        matchHelper('foo/+/#', 'foo/bar/baz')
        matchHelper('#', 'foo/bar/baz')
        matchHelper('/#', '/foo/bar')

        const subscribeTopics = new Map([
            ['foo/#', 'foo'],
            ['foo//bar', 'foo//bar'],
            ['foo//+', 'foo//bar'],
            ['foo/+/+/baz', 'foo///baz'],
            ['foo/bar/+', 'foo/bar/'],
            ['foo/bar', 'foo/bar'],
            ['foo/+', 'foo/bar'],
            ['foo/+/baz', 'foo/bar/baz'],
            ['A/B/+/#', 'A/B/B/C'],
            ['foo/+/#', 'foo/bar'],
            ['#', 'foo/bar/baz'],
            ['/#', '/foo/bar']
        ])

        subscribeTopics.forEach(function(value, key) {
            const matcher = new TopicMatcher<number>()
            const tSubscriber = new emptyTestSubscriber()

            matcher.subscribe(key, tSubscriber)
            const subscribers = matcher.match(value)
            expect(subscribers.length).to.equal(1)
            subscribers[0].onData(emittingValue)
        })
    })

    it('Topic unsuccessful matches', () => {
        const noMatchHelper = function(subtopic: string, topic: string) {
            const matcher = new TopicMatcher<number>()
            try {
                const tSubscriber = new emptyTestSubscriber()
                matcher.subscribe(subtopic, tSubscriber)
                const subscribers = matcher.match(topic)
                expect(subscribers.length).to.equal(0)
            } catch (e) {
                expect.fail('exception thrown' + e + ' for sub topic ' + subtopic + ' and topic to match ' + topic)
            }
        }

        noMatchHelper('test/6/#', 'test/3')
        noMatchHelper('foo/bar', 'foo')
        noMatchHelper('foo/+', 'foo/bar/baz')
        noMatchHelper('foo/+/baz', 'foo/bar/bar')
        noMatchHelper('foo/+/#', 'fo2/bar/baz')
        noMatchHelper('/#', 'foo/bar')

        const noMatchThrowHelper = function(subtopic: string, topic: string) {
            const matcher = new TopicMatcher<number>()
            const tSubscriber = new emptyTestSubscriber()
            matcher.subscribe(subtopic, tSubscriber)
            matcher.match(topic)
        }

        expect(() => noMatchThrowHelper('+foo', '+foo')).to.throw()
        expect(() => noMatchThrowHelper('fo+o', 'fo+o')).to.throw()
        expect(() => noMatchThrowHelper('foo+', 'foo+')).to.throw()
        expect(() => noMatchThrowHelper('+foo/bar', '+foo/bar')).to.throw()
        expect(() => noMatchThrowHelper('foo+/bar', 'foo+/bar')).to.throw()
        expect(() => noMatchThrowHelper('foo/+bar', 'foo/+bar')).to.throw()
        expect(() => noMatchThrowHelper('foo/bar+', 'foo/bar+')).to.throw()
        expect(() => noMatchThrowHelper('+foo', 'afoo')).to.throw()
        expect(() => noMatchThrowHelper('fo+o', 'foao')).to.throw()
        expect(() => noMatchThrowHelper('foo+', 'fooa')).to.throw()
        expect(() => noMatchThrowHelper('+foo/bar', 'afoo/bar')).to.throw()
        expect(() => noMatchThrowHelper('foo+/bar', 'fooa/bar')).to.throw()
        expect(() => noMatchThrowHelper('foo/+bar', 'foo/abar')).to.throw()
        expect(() => noMatchThrowHelper('foo/bar+', 'foo/bara')).to.throw()
        expect(() => noMatchThrowHelper('#foo', '#foo')).to.throw()
        expect(() => noMatchThrowHelper('fo#o', 'fo#o')).to.throw()
        expect(() => noMatchThrowHelper('foo#', 'foo#')).to.throw()
        expect(() => noMatchThrowHelper('#foo/bar', '#foo/bar')).to.throw()
        expect(() => noMatchThrowHelper('foo#/bar', 'foo#/bar')).to.throw()
        expect(() => noMatchThrowHelper('foo/#bar', 'foo/#bar')).to.throw()
        expect(() => noMatchThrowHelper('foo/bar#', 'foo/bar#')).to.throw()
        expect(() => noMatchThrowHelper('foo+', 'fooa')).to.throw()
    })

    it('Topic unsubscribe', () => {

        const topic = 'foo/#'
        const topicToMatch = 'foo/'

        const matcher = new TopicMatcher<number>()
        const tSubscriber = new emptyTestSubscriber()
        matcher.subscribe(topic, tSubscriber)
        let subscribers = matcher.match(topicToMatch)
        expect(subscribers.length).to.equal(1)
        matcher.unsubscribe(topic)
        subscribers = matcher.match(topicToMatch)
        expect(subscribers.length).to.equal(0)
    })

    it('Topic unsubscribers', () => {
        const subscribeTopics = [
            'foo/#',
            'foo/bar/a/+',
            'foo/bar/a/b',
        ]
        const topicToMatch = 'foo/bar/a/b'

        const matcher = new TopicMatcher<number>()
        const tSubscriber = new emptyTestSubscriber()

        subscribeTopics.forEach(function(el) {
            matcher.subscribe(el, tSubscriber)
        })

        const subscribers = matcher.match(topicToMatch)
        expect(subscribers.length).to.equal(3)
    })
})
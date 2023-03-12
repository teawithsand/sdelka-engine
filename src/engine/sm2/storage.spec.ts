import { generateUUID, TimestampMs } from "@teawithsand/tws-stl"
import { InMemoryEngineStorage } from "../../storage/memory/storage"
import { DebugClock } from "../clock"
import { SM2CardType } from "./defines"
import { SM2EngineQueueElementExtractor } from "./queues"
import { SM2EngineStorage } from "./storage"

describe("SM2EngineStorage", () => {
	let storage: SM2EngineStorage
	let clock: DebugClock
	beforeEach(() => {
		const inMem = new InMemoryEngineStorage()
		const queue = inMem.getQueue("main", SM2EngineQueueElementExtractor)
		clock = new DebugClock()
		storage = new SM2EngineStorage(queue, clock)
	})

	it("yields new cards in correct order", async () => {
		const ids = new Array(10).map(() => generateUUID())
		for (const id of ids) {
			await storage.appendNewCard(id)
		}

		for (const id of ids) {
			const data = await storage.getTodaysTopEngineCardData()
			expect(data?.id).toEqual(id)
			await storage.setEngineCardData({
				id: id,
				type: SM2CardType.LEARNED,
				desiredPresentationTimestamp: (clock.getNow() +
					1000 * 60 * 60 * 24) as TimestampMs,
				easeFactor: 1.2,
				interval: 100000,
				lapCount: 0,
			})
		}

		expect(await storage.getTodaysTopEngineCardData()).toEqual(null)
	})

	it("yields learned cards only for specified day", async () => {
		const ids = [...new Array(10).keys()].map(() => generateUUID())
		let i = 0
		for (const id of ids) {
			i++
			const ts = (1000 * 60 * 60 * 24 + i) as TimestampMs
			expect(clock.getDay(ts)).toEqual(1)
			await storage.setEngineCardData({
				id: id,
				type: SM2CardType.LEARNED,
				desiredPresentationTimestamp: ts,
				easeFactor: 1.2,
				interval: 100000,
				lapCount: 0,
			})
		}

		for (let _id of ids) {
			await storage.setEngineCardData({
				id: generateUUID(),
				type: SM2CardType.LEARNED,
				desiredPresentationTimestamp: (1000 *
					60 *
					60 *
					24 *
					3) as TimestampMs,
				easeFactor: 1.2,
				interval: 100000,
				lapCount: 0,
			})
		}

		clock.set(0 as TimestampMs)
		expect(await storage.getTodaysTopEngineCardData()).toBe(null)

		clock.set((1000 * 60 * 60 * 24 + 10) as TimestampMs)
		expect(clock.getDay(clock.getNow())).toEqual(1)
		for (const id of ids) {
			const card = await storage.getTodaysTopEngineCardData()
			if (!card) throw new Error("no card but expected one")

			expect(card.id).toEqual(id)

			await storage.setEngineCardData({
				id: id,
				type: SM2CardType.LEARNED,
				desiredPresentationTimestamp: (1000 *
					60 *
					60 *
					24 *
					10) as TimestampMs,
				easeFactor: 1.2,
				interval: 100000,
				lapCount: 0,
			})
		}

		expect(await storage.getTodaysTopEngineCardData()).toEqual(null)
	})
})
/*

import { generateUUID, throwExpression, TimestampMs } from "@teawithsand/tws-stl"
import { InMemoryEngineStorage } from "../../storage/memory/storage"
import { InMemoryCardSource } from "../../storage/source"
import { DebugClock } from "../clock"
import { EngineAnswer } from "../defines"
import {
	SM2EngineCardData,
	SM2EngineConfig,
	SM2EngineSessionData,
} from "./defines"
import { SM2Engine } from "./engine"

type Data = {
	id: string
	i: number
}

const config: SM2EngineConfig = {
	dayOffset: 0,

	newCardsPerDay: 30,

	skipLearningInterval: 1000 * 60 * 60 * 24 * 4,
	skipLearningEaseFactor: 2,

	initEaseFactor: 1.4,
	minEaseFactor: 1.2,
	maxEaseFactor: 4,

	hardEaseFactorDelta: 0.1,
	easyEaseFactorDelta: 0.2,
	lapEaseFactorDelta: 0.2,

	maxInterval: 1000 * 60 * 60 * 24 * 365,
	graduatedInterval: 1000 * 60 * 60 * 24,
	relearnedInterval: 1000 * 60 * 60 * 24,
	lapInterval: 1000 * 60,

	learningSteps: [1000 * 60, 1000 * 60 * 10],
	relearningSteps: [1000 * 60, 1000 * 60 * 10],
}

const cards: Data[] = [...new Array(100).keys()].map((i) => ({
	id: generateUUID(),
	i,
}))

describe("sm2 engine", () => {
	let engine: SM2Engine<Data>
	let clock: DebugClock
	let storage: InMemoryEngineStorage<SM2EngineCardData, SM2EngineSessionData>
	beforeEach(() => {
		clock = new DebugClock(1000 as TimestampMs)
		storage = new InMemoryEngineStorage()

		engine = new SM2Engine(
			storage,
			new InMemoryCardSource(cards),
			config,
			clock
		)
	})

	it("can take new cards", async () => {
        await engine.fetchNewCardsUntilLimit()

        const card = await engine.getCurrentCard()
        expect(card).not.toBeNull()
    })

    it("can answer for card", async () => {
        await engine.fetchNewCardsUntilLimit()

        const card = await engine.getCurrentCard()
		expect(card).toBeTruthy()
        await engine.answer(EngineAnswer.AGAIN)

		engine.getEngineCardData(card?.id ?? throwExpression(new Error("Unreachable code")))
    })
})

*/

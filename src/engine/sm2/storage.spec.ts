import { TimestampMs, generateUUID } from "../../util/stl"
import { DUMMY_SYNC_DATA } from "../../util/sync"
import { DebugClock } from "../clock"
import { InMemoryEngineStorage } from "../storage"
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

	/*
	it("yields new cards in correct order", async () => {
		const ids: [number, string][] = [...new Array(10).keys()].map((i) => [i, generateUUID()])
		for (const [i, id] of ids) {
			await storage.appendNewCard(id, i)
		}

		for (const [_, id] of ids) {
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
	*/

	it("yields learned cards only for specified day", async () => {
		const ids = [...new Array(10).keys()].map(() => generateUUID())
		let i = 0
		for (const id of ids) {
			i++
			const ts = (1000 * 60 * 60 * 24 + i) as TimestampMs
			expect(clock.getDay(ts)).toEqual(1)
			await storage.setEngineCardData({
				id: id,
				syncData: DUMMY_SYNC_DATA,
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
				syncData: DUMMY_SYNC_DATA,
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
				syncData: DUMMY_SYNC_DATA,
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
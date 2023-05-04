import { IndexedDBEngineStorageDB } from "../../storage"
import { InMemoryEngineStorage } from "../../storage/memory"
import { TimestampMs, generateUUID, throwExpression } from "../../util/stl"
import { DebugClock } from "../clock"
import { SM2CardType, SM2EngineAnswer, SM2EngineConfig } from "./defines"
import { SM2Engine } from "./engine"

type Card = {
	id: string
	i: number
}

const config: SM2EngineConfig = {
	initialDailyConfig: {
		additionalNewCardsToProcess: 0,
		learnedCardDaysFutureAllowed: 0,
		learnedCountOverride: {
			limit: null,
			limitIsRelative: true,
		},
	},

	maxLearnedReviewsPerDay: 100,
	maxNewCardsPerDay: 30,

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

describe("SM2Engine", () => {
	jest.setTimeout(10 * 1000)

	let engine: SM2Engine
	let clock: DebugClock
	const cards = [...new Array(config.maxNewCardsPerDay + 100).keys()].map(
		(i) => ({
			id: `${i}-` + generateUUID(),
			i,
		})
	)
	Object.freeze(cards)

	const makeAllLearned = async () => {
		for (;;) {
			const card = await engine.getCurrentCard()
			if (!card) break
			await engine.answer(SM2EngineAnswer.GOOD)
		}
	}

	beforeEach(async () => {
		clock = new DebugClock(1000 as TimestampMs)
		engine = new SM2Engine(new InMemoryEngineStorage(), config, clock)

		for (const c of cards) {
			await engine.addCard(c.id)
		}
	})

	it("yields proper amount of new cards", async () => {
		await engine.getCurrentCard()

		const stats = await engine.getStats()
		expect(stats.newCount).toEqual(config.maxNewCardsPerDay)
	})

	it("yields new cards in insertion order", async () => {
		for (let i = 0; i < config.maxNewCardsPerDay; i++) {
			const card = await engine.getCurrentCard()
			expect(card).toStrictEqual(cards[i].id)

			await engine.answer(SM2EngineAnswer.EASY)
		}
	})

	it("automatically loads new cards on new day until limit", async () => {
		let offset = 0
		for (let i = 0; i < config.maxNewCardsPerDay / 2; i++) {
			await engine.answer(SM2EngineAnswer.EASY)
			offset++
		}
		expect((await engine.getStats()).newCount).toEqual(
			config.maxNewCardsPerDay - offset
		)
		clock.nextDay()
		expect((await engine.getStats()).newCount).toEqual(
			config.maxNewCardsPerDay
		)
	})

	it("yields null card if there is no more cards to process today", async () => {
		const stats = await engine.getStats()
		for (
			let i = 0;
			i <
			stats.newCount +
				stats.learningCount +
				stats.relearningCount +
				stats.repetitionCount;
			i++
		) {
			await engine.answer(SM2EngineAnswer.EASY)
		}
		expect(await engine.getCurrentCard()).toBe(null)
	})

	it("moves cards all cards from new to learning then to learned", async () => {
		for (;;) {
			const stats = await engine.getStats()
			expect(0).toEqual(stats.repetitionCount)
			expect(0).toEqual(stats.relearningCount)

			const card = await engine.getCurrentCard()
			const cardData = await engine.getCurrentCardData()
			if (!card || !cardData) break
			await engine.answer(SM2EngineAnswer.GOOD)
			const newCardData = await engine.cardStorage.getEngineCardData(
				cardData.id
			)
			if (!newCardData)
				throw new Error("Card data was lost for some reason")

			if (cardData.type === SM2CardType.NEW) {
				expect(SM2CardType.LEARNING).toEqual(newCardData.type)
			}

			if (newCardData.type === SM2CardType.LEARNED) {
				expect(SM2CardType.LEARNING).toEqual(cardData.type)
			}
		}
	})

	it("can undo card", async () => {
		const card =
			(await engine.getCurrentCard()) ??
			throwExpression(new Error(`No card`))
		await engine.answer(SM2EngineAnswer.GOOD)

		await engine.undo()

		expect(
			(await engine.cardStorage.getEngineCardData(card))?.type
		).toEqual(SM2CardType.NEW)

		const stats = await engine.getStats()
		expect(stats.newCount).toEqual(config.maxNewCardsPerDay)
	})

	it("can undo card when there are added/removed cards", async () => {
		await engine.updateRuntimeConfig(draft => {
			draft.additionalNewCardsToProcess += 30
		})

		const card =
			(await engine.getCurrentCard()) ??
			throwExpression(new Error(`No current card`))

		const toProcessCount = 3
		for (let i = 0; i < toProcessCount; i++) {
			await engine.answer(SM2EngineAnswer.EASY)
		}

		await engine.updateRuntimeConfig(draft => {
			draft.additionalNewCardsToProcess -= 10
		})
		const oldStats = await engine.getStats()

		for (let i = 0; i < toProcessCount; i++) {
			await engine.undo()
		}

		expect(await engine.getCurrentCard()).toEqual(card)

		const newStats = await engine.getStats()
		expect(newStats.newCount).toEqual(oldStats.newCount + toProcessCount)
	})
})

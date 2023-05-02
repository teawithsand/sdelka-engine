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

	/*
	it("can add/remove new cards to preserve count", async () => {
		const firstCard =
			(await engine.getCurrentCard()) ??
			throwExpression(new Error(`No first card`))
		const stats = await engine.getStats()
		expect(config.maxNewCardsPerDay).toEqual(stats.newCount)

		await engine.addOrRemoveNewCards(20)

		expect((await engine.getStats()).newCount).toEqual(
			config.maxNewCardsPerDay + 20
		)

		await engine.addOrRemoveNewCards(-cards.length)

		expect((await engine.getStats()).newCount).toEqual(0)

		await engine.addOrRemoveNewCards(3 * cards.length)
		expect((await engine.getStats()).newCount).toEqual(cards.length)

		await engine.addOrRemoveNewCards(-cards.length / 2)
		let count = cards.length / 2

		expect((await engine.getStats()).newCount).toEqual(count)

		await engine.addOrRemoveNewCards(100)
		expect((await engine.getStats()).newCount).toEqual(count + 100)

		const steps = [
			997, -490, 45, -608, -470, 556, -457, 535, 453, 8, 317, -330, -681,
			-420, 468, 609, 48, 145, 445, 365, 103, -193, -499, 507, 849, -151,
			-603, -539, 553, -943, -111, -890, 341, 63, 386, -388, 615, 566,
			-388, 602, -325, 881, -619, 45, -295, -643, -973, -546, 935, 725,
			-312, -153, 744, 236, -944, -328, 127, 261, -596, -451, 209, -797,
			-432, 232, 41, 993, -40, -964, -967, -535, 892, 515, 170, 664, -903,
			470, 957, 797, -853, -25, 282, -34, 298, 325, -483, -359, -926,
			-419, -735, 47, -735, -275, 572, -124, 804, -884, 286, -386, -779,
			-76, 438, -290, 79, -815, 943, 408, 717, 565, 440, 82, -188, -704,
			549, 538, -565, -108, -353, 850, 226, -205, 978, -347, -544, 265,
			-790, 191, -427, -786, -163, 184, 775, 48, 661, 747, -996, -573,
			813, -785, 774, -874, -767, -806, 320, 709, 144, -666, -632, -551,
			-279, -784, 476, -223, 861, 289, -390, -628, -197, 114, -680, 590,
			-342, 756, 449, -812, 121, -222, 768, 704, 484, -50, 835, 51, 838,
			-475, 323, -8, -842, 344, 304, -4, -678, -565, 166, 462, 973, 21,
			675, 339, 464, -88, -4, 252, 716, -74, 403, -655, -782, 609, 858,
			-611, 101, 528, -151, 777, 87, -138, 550, 163, 810, 479, 305, -957,
			69, -320, -507, -110, -146, 609, 914, 687, -188, 772, 693, 427,
			-277, -683, -507, 146, -495, 870, -661, 404, 763, -976, -663, -798,
			20, 922, 101, -741, 679, 599, 585, 550, -104, -277, 570, -993, -866,
			-521, 734, -597, -326, -414, -441, 275, 717, -46, -262, -804, -317,
			-946, 168, 866, 787, -207, -840, -271, 368, -220, -836, -276, -703,
			184, 586, -313, -735, -675, 525, -100, 237, 532, 153, 613, -190,
			132, -579, -201, 419, -757, -535, 827, 185, -936, 196, 874, 62,
			-824, 16, 426, -82, -94, -84, -66, -10, -100, -33, 30, 98, -43, 91,
			11, -37, -63, -9, -79, 23, 61, 21, -21, 22, 94, 92, 21, 56, -71, 43,
			-30, 49, -68, -53, -11, 67, -57, 75, 27, 81, 31, -50, -21, -100,
			-18, -74, -23, -82, -98, -42, -40, 89, 0, 91, 77, 27, -21, -21, -84,
			-35, 17, 98, 40, -47, 57, -56, -9, 9, -86, 7, -66, 60, -38, 81, -43,
			-48, -53, -29, 44, 86, 90, 9, -9, -38, -57, 2, 76, 33, -48, 42, 32,
			-54, 23, 7, 55, 67, 74, 51, 75, -78, 23, -24, 8, 99, 12, 37, 63,
			-83, 56, 100, 88, 11, -78, -18, 79, 73, 61, -44, 53, 98, -71, 71,
			-99, 99, -31, -42, -65, -8, -26, -84, 25, -14, -93, -63, 62, 64, 13,
			-48, -16, -30, -64, -33, 0, -45, 74, -6, -42, 39, 14, 6, -61, -89,
			40, -26, -43, -22, 72, 59, 14, 19, 17, -99, 100, 56, -76, -37, 51,
			-43, 14, -53, -51, -89, -5, 53, 36, 5, 0, -21, 30, -44, -77, 18, 21,
			-78, -45, 15, -23, 99, 7, 36, 41, 50, 55, -39, 32, 46, 17, -92, 80,
			-82, -48, 67, 52, -43, -97, 21, -99, -83, -99, -17, 71, 31, 56, -89,
			-27, -54, 9, 79, 32, -65, -99, 11, 42, -1, 39, -18, 43, -97, -12,
			70, -47, -50, 33, -5, 72, -34, -27, 12, 47, 34, 57, -63, -79, -41,
			74, 50, -70, 36, -98, 14, -25, 22, -26, -8, 20, 89, -76, 17, 78,
			-95, 58, 94, -72, 34, 0, 74, 36, -62, 36, -82, 9, -18, -68, 91, -65,
			79, -61, -55, 59, 3, 1, 72, -14, -56, 62, 36, 73, 5, -17, 26, 6,
			-37, 97, -8, 100, -98, 38, 46, -69, -70, -12, 43, 78,
		]

		for (const s of steps) {
			await engine.addOrRemoveNewCards(s)

			count += s
			count = Math.min(count, cards.length)
			count = Math.max(count, 0)
			expect((await engine.getStats()).newCount).toEqual(count)

			if (count === 0) {
				expect(await engine.getCurrentCard()).toBeNull()
			} else {
				expect(await engine.getCurrentCard()).toEqual(firstCard)
			}
		}
	})
	*/
})

describe("noop", () => {
	it("does nothing", () => {})
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

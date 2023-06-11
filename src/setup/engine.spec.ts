import produce from "immer"
import {
	EngineAnswer,
	EngineConfig,
	EngineEntryData,
	EngineEntryDataType,
} from "../engine"
import { App, AppEngineOpts, initializeApp } from "./app"
import { DefaultEngineConfig } from "./config"
import { TimestampMs, generateUUID, throwExpression } from "../internal/stl"
import { DebugClock } from "../util"

describe("Master store / Master Engine", () => {
	let app: App

	jest.setTimeout(100000000) // so debugger works fine; should be removed in future

	beforeEach(async () => {
		app = await initializeApp()
		await app.store.clear()
	})

	const initForEngine = async (
		opts: {
			cardCount?: number
			config?: EngineConfig
			appEngineOpts?: AppEngineOpts
		} = {}
	) => {
		const collection = await app.store.createCollection({
			name: "asdf",
			description: "asdf",
			isOutOfSync: true,
			syncKey: "asdf",
		})

		const view = app.store.getCollectionEntriesView(collection.id)

		const entriesIds: string[] = []
		for (let i = 0; i < (opts.cardCount ?? 100); i++) {
			const entity = await view.addCard({
				isOutOfSync: true,
				priority: 0,
				syncKey: generateUUID(),
				tags: [],
			})

			entriesIds.push(entity.id)
		}

		const engine = await app.getEngine(
			collection.id,
			opts.config ?? DefaultEngineConfig,
			opts.appEngineOpts
		)

		if (!engine) throw new Error(`Cant access engine`)

		return {
			engine,
			entriesIds: [...entriesIds],

			getEntryDatas: async () => {
				const res: EngineEntryData[] = []
				for (const eid of entriesIds) {
					res.push(
						(await engine.getEntryData(eid)) ??
							throwExpression(new Error(`No data for id ${eid}`))
					)
				}

				return res
			},
		}
	}

	it("can create/edit collection + can add/mutate cards", async () => {
		const collectionData = {
			name: "Collection one",
			isOutOfSync: true,
			description: "Some collection idk",
			syncKey: generateUUID(),
		}
		const collection = await app.store.createCollection(collectionData)

		const access = await app.store.getAccess(collection.id)
		const loadedData = await access.getData()
		expect(loadedData?.collectionData).toEqual(collectionData)

		const cardsView = app.store.getCollectionEntriesView(collection.id)

		{
			const cards = await cardsView.iterate().toArray()
			expect(cards).toEqual([])
		}

		{
			const uuids = [1, 1, 1].map(() => generateUUID())

			uuids.sort((a, b) => a.localeCompare(b))

			for (const syncKey of uuids) {
				await cardsView.addCard({
					isOutOfSync: true,
					priority: 0,
					syncKey: syncKey,
					tags: [],
				})
			}
			const initialCards = await cardsView.iterate().toArray()
			{
				const cardSyncKeys = initialCards.map((v) => v.userData.syncKey)
				cardSyncKeys.sort((a, b) => a.localeCompare(b))

				expect(cardSyncKeys).toEqual(uuids)
			}

			const access =
				(await cardsView.getAccess(initialCards[0].id)) ??
				throwExpression(new Error(`Cant get access`))

			await access.delete()

			{
				const cardSyncKeys = (await cardsView.iterate().toArray()).map(
					(v) => v.userData.syncKey
				)
				cardSyncKeys.sort((a, b) => a.localeCompare(b))

				expect(cardSyncKeys.length).toEqual(uuids.length - 1)
				expect(cardSyncKeys).toEqual(
					uuids.filter(
						(uuid) => uuid !== initialCards[0].userData.syncKey
					)
				)
			}
		}
	})

	it("can get initial stats", async () => {
		const { engine } = await initForEngine({
			cardCount:
				DefaultEngineConfig.initialDailyConfig.newCardLimit + 100,
		})

		const stats = await engine.getQueuesStats()

		expect(stats.newCardsLeft).toEqual(
			DefaultEngineConfig.initialDailyConfig.newCardLimit
		)
		expect(stats.learnedLeft).toEqual(0)
		expect(stats.relearningLeft).toEqual(0)
		expect(stats.learningLeft).toEqual(0)
	})

	it("can answer to modify stats", async () => {
		const clock = new DebugClock(1000 as TimestampMs)
		const { engine } = await initForEngine({
			cardCount:
				DefaultEngineConfig.initialDailyConfig.newCardLimit + 100,
			appEngineOpts: {
				clockOverride: clock,
			},
		})

		const card = await engine.getCurrentEntry()
		expect(card).not.toBe(null)

		await engine.answer(EngineAnswer.AGAIN)

		{
			const stats = await engine.getQueuesStats()

			expect(stats.learningLeft).toEqual(1)
			expect(stats.newCardsLeft).toEqual(
				DefaultEngineConfig.initialDailyConfig.newCardLimit - 1
			)
		}

		await engine.answer(EngineAnswer.EASY)

		{
			const stats = await engine.getQueuesStats()

			expect(stats.learningLeft).toEqual(1)
			expect(stats.newCardsLeft).toEqual(
				DefaultEngineConfig.initialDailyConfig.newCardLimit - 2
			)
		}
	})

	it("serves learning/relearning card rather than new if desired presentation ts says so", async () => {
		const clock = new DebugClock(1000 as TimestampMs)
		const { engine } = await initForEngine({
			cardCount:
				DefaultEngineConfig.initialDailyConfig.newCardLimit + 100,
			appEngineOpts: {
				clockOverride: clock,
			},
		})

		const card = await engine.getCurrentEntry()
		expect(card).not.toBe(null)

		const currentEntryData =
			(await engine.getCurrentEntry()) ??
			throwExpression(new Error("No current entry"))
		await engine.answer(EngineAnswer.AGAIN)
		await engine.getCurrentEntry()

		const data =
			(await engine.getEntryData(currentEntryData.id)) ??
			throwExpression(new Error("No current entry data"))

		if (data.type !== EngineEntryDataType.LEARNING) {
			throw new Error(`Invalid entry type`)
		}

		// do not add anything here to detect off-by-one errors
		const delta = data.desiredPresentationTimestamp - clock.getNow()
		clock.advance(delta)
		expect(clock.getNow()).toEqual(data.desiredPresentationTimestamp)

		// some other card here. It was loaded once we answered to previous one
		await engine.answer(EngineAnswer.EASY)

		const nextEntryId =
			(await engine.getCurrentEntry()) ??
			throwExpression(new Error("No next current entry"))

		expect(currentEntryData.id).toEqual(nextEntryId.id)
	})

	it("moves all cards to learned after enough presses of good button + processes learned and new cards on next day", async () => {
		const clock = new DebugClock(1000 as TimestampMs)

		const config = produce(DefaultEngineConfig, (draft) => {
			draft.initialDailyConfig.newCardLimit = 30
		})
		const { engine } = await initForEngine({
			cardCount: config.initialDailyConfig.newCardLimit + 10,
			config: config,
			appEngineOpts: {
				clockOverride: clock,
			},
		})

		const limit = 1000
		const entriesIds = new Set<string>()
		for (var i = 0; i < limit; i++) {
			const currentEntryData = await engine.getCurrentEntry()
			if (!currentEntryData) {
				expect(entriesIds.size).toEqual(
					DefaultEngineConfig.initialDailyConfig.newCardLimit
				)
				break
			}

			entriesIds.add(currentEntryData.id)
			await engine.answer(EngineAnswer.GOOD)
		}

		if (i === limit) {
			throw new Error("Unreachable code; too many iterations required")
		}

		{
			const stats = await engine.getQueuesStats()

			expect(stats.learningLeft).toEqual(0)
			expect(stats.relearningLeft).toEqual(0)
			expect(stats.learnedLeft).toEqual(0)
			expect(stats.newCardsLeft).toEqual(0)
		}

		clock.advance(1000 * 24 * 60 * 60)
		await engine.refresh() // has to be done manually

		{
			const stats = await engine.getQueuesStats()
			expect(stats.learningLeft).toEqual(0)
			expect(stats.relearningLeft).toEqual(0)
			expect(stats.newCardsLeft).toEqual(10)
			expect(stats.learnedLeft).toEqual(30)
		}

		{
			const entry =
				(await engine.getCurrentEntry()) ??
				throwExpression(new Error(`No current entry`))

			expect(entry.type).toEqual(EngineEntryDataType.LEARNED)

			await engine.answer(EngineAnswer.GOOD)

			const stats = await engine.getQueuesStats()
			expect(stats.learningLeft).toEqual(0)
			expect(stats.relearningLeft).toEqual(0)
			expect(stats.newCardsLeft).toEqual(10)
			expect(stats.learnedLeft).toEqual(29)
		}
	})

	// TODO(teawithsand): tests for undo
})

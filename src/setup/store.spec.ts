import { EngineConfig } from "../engine"
import { generateUUID, throwExpression } from "../util/stl"
import { App, AppEngineOpts, initializeApp } from "./app"
import { DefaultEngineConfig } from "./config"

describe("Master store", () => {
	let app: App

	jest.setTimeout(100000000)

	beforeEach(async () => {
		app = await initializeApp()
		await app.store.clear()
	})

	const initForEngine = async (
		config?: EngineConfig,
		opts?: AppEngineOpts
	) => {
		const collection = await app.store.createCollection({
			name: "asdf",
			description: "asdf",
			isOutOfSync: true,
			syncKey: "asdf",
		})

		const view = app.store.getCollectionEntriesView(collection.id)

		for (let i = 0; i < 100; i++) {
			await view.addCard({
				isOutOfSync: true,
				priority: 0,
				syncKey: generateUUID(),
				tags: [],
				values: {
					q: i.toString(),
					a: generateUUID(),
				},
			})
		}

		const engine = await app.getEngine(
			collection.id,
			config ?? DefaultEngineConfig,
			opts
		)

		if (!engine) throw new Error(`Cant access engine`)

		return {
			engine,
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
					values: {
						key: "value",
					},
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

	it("can run engine", async () => {
		const { engine } = await initForEngine()

		const card = await engine.getCurrentCard()
		expect(card).not.toBe(null)
	})
})

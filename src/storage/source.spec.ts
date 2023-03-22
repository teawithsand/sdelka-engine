import { generateUUID } from "@teawithsand/tws-stl"
import { CombinedCardSource } from "./combined"
import { InMemoryCardSource } from "./memory"
import { AppendDeleteCardSource, CardSource } from "./source"

type Card = {
	id: string
	i: number
}

const baseCards: Card[] = [...new Array(10).keys()].map((i) => ({
	id: generateUUID(),
	i,
}))

/**
 * Note: source has to be populated with baseCards in order for these to pass.
 */
const testCardSource = (sourceFactory: () => Promise<CardSource<Card>>) => {
	let source: CardSource<Card>
	beforeEach(async () => {
		source = await sourceFactory()
	})

	it("can iterate through all cards", async () => {
		const cursor = source.newCursor()
		const ids = []
		for (;;) {
			if (cursor.currentId !== null) {
				ids.push(cursor.currentId)
			}
			const goneToNext = await cursor.next()
			if (!goneToNext) break
		}

		const recoveredCards: Card[] = []
		for (const id of ids) {
			const c = await source.getCard(id)
			if (!c) throw new Error(`Card with id ${id} was removed`)
			recoveredCards.push(c)
		}

		expect(recoveredCards).toEqual(baseCards)
	})

	it("can iterate through all cards with serialized cursor", async () => {
		let cursor = source.newCursor()
		const ids = []
		for (;;) {
			cursor = source.deserializeCursor(source.serializeCursor(cursor))
			if (cursor.currentId !== null) {
				ids.push(cursor.currentId)
			}
			const goneToNext = await cursor.next()
			if (!goneToNext) break
		}

		const recoveredCards: Card[] = []
		for (const id of ids) {
			const c = await source.getCard(id)
			if (!c) throw new Error(`Card with id ${id} was removed`)
			recoveredCards.push(c)
		}

		expect(recoveredCards).toEqual(baseCards)
	})
}

const testAppendDeleteCardSource = (
	sourceFactory: () => Promise<AppendDeleteCardSource<Card>>
) => {
	let source: AppendDeleteCardSource<Card>
	beforeEach(async () => {
		source = await sourceFactory()

		for (const c of baseCards) {
			await source.append(c)
		}
	})

	it("can iterate through all cards with deleting cards", async () => {
		let cursor = source.newCursor()
		const ids = []
		for (;;) {
			const { currentId } = cursor
			if (currentId !== null) {
				ids.push(currentId)
				await source.delete(currentId)

				await cursor.refresh()
				expect(await source.getCard(currentId)).toEqual(null)
			}

			expect(cursor.currentId).toEqual(null)
			const goneToNext = await cursor.next()
			if (!goneToNext) break
		}

		expect(ids).toEqual(baseCards.map((v) => v.id))
	})

	it("can iterate through all cards while skipping deleted", async () => {
		const cursor = source.newCursor()
		await cursor.next()

		for (let i = 0; i < baseCards.length / 2; i++) {
			await cursor.next()
		}

		const predicate: (v: any, i: number) => boolean = (_, i) =>
			i > baseCards.length / 2 && i % 3 !== 0

		for (const id of baseCards
			.filter((v, i) => !predicate(v, i))
			.map((v) => v.id)) {
			await source.delete(id)
		}

		const filteredCards = baseCards.filter(predicate).map((v) => v.id)

		await cursor.refresh()

		const ids = []
		for (;;) {
			if (cursor.currentId !== null) {
				ids.push(cursor.currentId)
			}
			const goneToNext = await cursor.next()
			if (!goneToNext) break
		}

		expect(ids).toEqual(filteredCards)
	})
}

describe("In-memory source", () => {
	testCardSource(async () => new InMemoryCardSource(baseCards))
	testAppendDeleteCardSource(async () => new InMemoryCardSource<Card>([]))
})

/*
describe("IDB source", () => {
	testCardSource(
		async () =>
			new IndexedDBCardSource<Card>(
				new IDBStorageDB("asdf1234"),
				generateUUID()
			)
	)

	testAppendDeleteCardSource(async () => {
		const src = new IndexedDBCardSource<Card>(
			new IDBStorageDB("asdf1234"),
			generateUUID()
		)

		for (const c of baseCards) {
			await src.append(c)
		}

		return src
	})
})
*/

describe("CombinedSource", () => {
	testCardSource(async () => {
		const sz = Math.floor(baseCards.length / 3)
		const chunks: Card[][] = [...new Array(sz).keys()].map(() => [])

		for (let i = 0; i < baseCards.length; i++) {
			chunks[Math.min(sz - 1, Math.floor(i / sz))].push(baseCards[i])
		}

		const sources = chunks.map((cards) => new InMemoryCardSource(cards))

		return new CombinedCardSource(
			sources.map((source, i) => ({
				source: source,
				sourceId: "src-" + generateUUID(),
				offset: i,
			}))
		)
	})
})

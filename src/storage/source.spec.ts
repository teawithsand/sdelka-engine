import { generateUUID } from "@teawithsand/tws-stl"
import { IDBStorageDB, IndexedDBCardSource } from "./idb"
import { InMemoryCardSource } from "./memory"
import { AppendDeleteCardSource } from "./source"

type Card = {
	id: string
	i: number
}

const baseCards: Card[] = [...new Array(100).keys()].map((i) => ({
	id: generateUUID(),
	i,
}))

const testAppendDeleteCardSource = (
	sourceFactory: () => AppendDeleteCardSource<Card>
) => {
	let source: AppendDeleteCardSource<Card>
	beforeEach(async () => {
		source = sourceFactory()

		for (const c of baseCards) {
			await source.append(c)
		}
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

		expect(ids).toEqual(baseCards.map((v) => v.id))
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

		expect(ids).toEqual(baseCards.map((v) => v.id))
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
	testAppendDeleteCardSource(() => new InMemoryCardSource<Card>([]))
})

describe("IDB source", () => {
	testAppendDeleteCardSource(() => {
		return new IndexedDBCardSource<Card>(
			new IDBStorageDB("asdf1234"),
			generateUUID()
		)
	})
})

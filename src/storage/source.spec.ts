import { generateUUID, throwExpression } from "../util/stl"
import { CombinedCardSource } from "./combined"
import { IDBStorageDB, IndexedDBCardSource } from "./idb"
import { InMemoryCardSource } from "./memory"
import { MutableCardSource, CardSource } from "./source"

type Card = {
	id: string
	i: number
}

const baseCards: Card[] = [...new Array(20).keys()].map((i) => ({
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

	// TODO(teawithsand): specialized test for .left method besides testing with advance

	it("stays at the last id after iteration finished", async () => {
		const lastCard = baseCards[baseCards.length - 1]

		{
			const cursor = source.newCursor()
			for (let i = 0; i < baseCards.length + 1; i++) {
				await cursor.next()
			}

			const id =
				cursor.currentId ??
				throwExpression(
					new Error(`last id must not be null if there are cards`)
				)
			expect(await source.getCard(id)).toEqual(lastCard)
		}

		{
			const cursor = source.newCursor()
			for (let i = 0; i < baseCards.length * 2; i++) {
				await cursor.next()
			}

			const id =
				cursor.currentId ??
				throwExpression(
					new Error(`last id must not be null if there are cards`)
				)
			expect(await source.getCard(id)).toEqual(lastCard)
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

	it("can iterate through all cards with cloned cursor", async () => {
		let cursor = source.newCursor()
		const ids = []
		for (;;) {
			const clone = cursor.clone()
			await clone.next()

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

	it("can iterate through all cards with advancing cursor", async () => {
		const advanceSets = [
			[4, 1, 3, 0, 0, 6, 1, 1, 4, 0],
			[2, 1, 1, 0, 0, 0, 2, 5, 0, 1],
			[0, 4, 7, 2, 1, 5, 10, 1, 2, 6],
			[0, 0, 0, 0, 2, 1, 1, 8, 9, 0],
			[1, 2, 2, 1, 2, 8, 8, 1, 5, 6],
			[0, 2, 2, 7, 3, 2, 3, 0, 9, 2],
			[5, 0, 4, 8, 2, 5, 7, 2, 0, 8],
			[4, 0, 0, 3, 8, 0, 0, 1, 3, 3],
			[1, 0, 9, 5, 1, 9, 2, 1, 3, 2],
			[1, 1, 2, 0, 2, 0, 0, 0, 1, 0],
			[0, 0, 0, 0, 4, 9, 0, 0, 4, 2],
			[0, 2, 2, 0, 1, 4, 7, 7, 5, 0],
			[0, 0, 1, 1, 1, 0, 0, 3, 3, 2],
			[5, 6, 2, 1, 3, 0, 1, 0, 0, 0],
			[3, 2, 4, 2, 4, 5, 6, 0, 8, 6],
			[6, 5, 4, 3, 2, 2, 5, 1, 2, 0],
			[3, 3, 2, 2, 1, 1, 1, 2, 0, 0],
			[2, 5, 1, 3, 3, 0, 1, 5, 8, 4],
			[2, 5, 9, 5, 2, 0, 0, 6, 1, 0],
			[1, 2, 0, 1, 7, 1, 0, 0, 9, 10],
		]

		for (const set of advanceSets) {
			const cursor = source.newCursor()

			let pos = -1
			let cursorPos = -1
			let sumShiftSoFar = 0
			const limit = baseCards.length

			const expectedCards = []
			const gotIds = []

			let advancedByNonZero = false
			for (const delta of set) {
				sumShiftSoFar += delta
				advancedByNonZero = advancedByNonZero || delta > 0
				const by = await cursor.advance(delta)
				pos = Math.min(limit - 1, pos + delta)
				cursorPos += by

				expect(pos).toEqual(cursorPos)
				if (pos >= 0) {
					expectedCards.push(baseCards[pos])
				}

				expect(await cursor.left()).toEqual(
					Math.max(0, baseCards.length - sumShiftSoFar)
				)

				const currentId = cursor.currentId
				if (currentId === null && advancedByNonZero)
					throw new Error(`Got null id where it's not allowed`)
				if (currentId !== null) {
					gotIds.push(
						cursor.currentId ??
							throwExpression(new Error("Unreachable code"))
					)
				}
			}

			const recoveredGotCards: Card[] = []
			for (const id of gotIds) {
				const c = await source.getCard(id)
				if (!c) throw new Error(`Card with id ${id} was removed`)
				recoveredGotCards.push(c)
			}

			expect(recoveredGotCards.length).toEqual(expectedCards.length)
			expect(recoveredGotCards).toEqual(expectedCards)
			expect(expectedCards.length).toBeGreaterThan(0)
		}
	})
}

const testMutableCardSource = (
	sourceFactory: () => Promise<MutableCardSource<Card>>
) => {
	let source: MutableCardSource<Card>
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

	// TODO(teawithsand): advance + delete test for sources

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
	testMutableCardSource(async () => new InMemoryCardSource<Card>([]))
})

describe("IDB source", () => {
	testCardSource(async () => {
		const src = new IndexedDBCardSource<Card>(
			new IDBStorageDB("asdf1234"),
			generateUUID()
		)

		for (const c of baseCards) {
			await src.append(c)
		}

		return src
	})

	testMutableCardSource(async () => {
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

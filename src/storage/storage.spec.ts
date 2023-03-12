import { generateUUID } from "@teawithsand/tws-stl"
import { IDBStorageDB, IDBEngineStorage } from "./idb/storage"
import { InMemoryEngineStorage } from "./memory/storage"
import { GroupedQueue, GroupedQueueRangeLike } from "./queue"
import { EngineStorage } from "./storage"

type Data = {
	n?: number
	t?: string
}

type PQData = {
	id: string
	priority: number
	group?: string
}

const G1 = "g1"
const G2 = "g2"
const G3 = "g3"

const testStorage = (storageFactory: () => EngineStorage<Data, Data>) => {
	let storage: EngineStorage<Data, Data>
	let queue: GroupedQueue<PQData>
	beforeEach(() => {
		storage = storageFactory()
		queue = storage.getQueue("q1", (e) => ({
			id: e.id,
			priority: e.priority,
			group: e.group ?? G1,
		}))
	})
	it("returns null session data during initialization", async () => {
		expect(await storage.getSessionData()).toBeNull()
	})
	it("stores session data", async () => {
		await storage.setSessionData({
			n: 10,
		})
		expect(await storage.getSessionData()).toEqual({
			n: 10,
		})
	})

	it("stores session data with respect to transactions", async () => {
		await storage.transaction(async () => {
			await storage.setSessionData({
				n: 10,
			})
		})
		expect(await storage.getSessionData()).toEqual({
			n: 10,
		})

		await storage
			.transaction(async () => {
				await storage.setSessionData({
					n: 20,
				})
				throw new Error("rollback")
			})
			.catch(() => {})
		expect(await storage.getSessionData()).toEqual({
			n: 10,
		})
	})

	it("can peekFront element in range", async () => {
		const SZ = 100
		const GROUPS = [G1, G2, G3]
		for (var i = 0; i < SZ; i++) {
			await queue.add({
				id: generateUUID(),
				priority: i + 1,
				group: GROUPS[i % GROUPS.length],
			})
		}

		const queryFront = async (range: GroupedQueueRangeLike) =>
			(await queue.peekFront([], range))?.priority ?? null

		const queryBack = async (range: GroupedQueueRangeLike) =>
			(await queue.peekBack([], range))?.priority ?? null

		for (let i = -SZ; i <= SZ; i++) {
			expect(
				await queryFront({
					fromIncl: i,
				})
			).toEqual(SZ)
		}

		for (let i = 1; i <= SZ * 2; i++) {
			expect(
				await queryFront({
					toIncl: i,
				})
			).toEqual(Math.min(i, SZ))
		}

		expect(
			await queryFront({
				fromIncl: SZ + 1,
			})
		).toStrictEqual(null)

		expect(
			await queryFront({
				fromExcl: SZ,
			})
		).toStrictEqual(null)

		expect(
			await queryFront({
				toIncl: 0,
			})
		).toStrictEqual(null)

		expect(
			await queryFront({
				toExcl: 1,
			})
		).toStrictEqual(null)
	})

	it("can popBack elements from queue", async () => {
		await queue.add({
			id: generateUUID(),
			priority: 1,
		})
		await queue.add({
			id: generateUUID(),
			priority: 0,
			group: G1,
		})
		await queue.add({
			id: generateUUID(),
			priority: 3,
			group: G2,
		})
		await queue.add({
			id: generateUUID(),
			priority: 2,
			group: G3,
		})

		expect((await queue.popBack([]))?.priority).toEqual(0)
		expect((await queue.popBack([]))?.priority).toEqual(1)
		expect((await queue.popBack([]))?.priority).toEqual(2)
		expect((await queue.popBack([]))?.priority).toEqual(3)
	})

	it("can popFront elements from queue", async () => {
		await queue.add({
			id: generateUUID(),
			priority: 1,
		})
		await queue.add({
			id: generateUUID(),
			priority: 0,
			group: G1,
		})
		await queue.add({
			id: generateUUID(),
			priority: 3,
			group: G2,
		})
		await queue.add({
			id: generateUUID(),
			priority: 2,
			group: G3,
		})

		expect((await queue.popFront([]))?.priority).toEqual(3)
		expect((await queue.popFront([]))?.priority).toEqual(2)
		expect((await queue.popFront([]))?.priority).toEqual(1)
		expect((await queue.popFront([]))?.priority).toEqual(0)
	})

	it("can add that changes element's group", async () => {
		const id = generateUUID()
		await queue.add({
			id,
			priority: 2,
			group: G1,
		})
		await queue.add({
			id,
			priority: 1,
			group: G2,
		})
		expect(await queue.peekFront([G1])).toBeFalsy()
		expect((await queue.peekFront([G2]))?.priority).toEqual(1)
	})

	it("does not have not existing ids", async () => {
		const ids = [...new Array(100).keys()].map(() => generateUUID())
		let i = 0
		for (const id of ids) {
			await queue.add({
				id,
				priority: i,
				group: G1,
			})
			i++
		}

		for (let i = 0; i < 100; i++) {
			expect(await queue.hasId(generateUUID())).toEqual(false)
		}
	})

	it("can do get element by id", async () => {
		const ids = [...new Array(100).keys()].map(() => generateUUID())
		let i = 0
		for (const id of ids) {
			await queue.add({
				id,
				priority: i,
				group: G1,
			})
			i++
		}

		i = 0
		for (const id of ids) {
			expect((await queue.getId(id))?.priority).toEqual(i)
			expect(await queue.hasId(id)).toEqual(true)
			i++
		}
	})

	// TODO(teawithsand): more tests for storage
}

describe("In-memory storage", () => {
	testStorage(() => new InMemoryEngineStorage())
})

describe("IDB storage", () => {
	const db = new IDBStorageDB<any, any>("db-0")
	testStorage(() => new IDBEngineStorage(db, generateUUID()))

	// TODO(teawithsand): tests for conflicting session names
})

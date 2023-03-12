import { generateUUID } from "@teawithsand/tws-stl"
import { InMemoryEngineStorage } from "./memory/storage"
import { GroupedQueue } from "./queue"
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

	it("can push/pop elements to/from queue", async () => {
		await queue.push({
			id: generateUUID(),
			priority: 1,
		})
		await queue.push({
			id: generateUUID(),
			priority: 0,
			group: G1,
		})
		await queue.push({
			id: generateUUID(),
			priority: 3,
			group: G2,
		})
		await queue.push({
			id: generateUUID(),
			priority: 2,
			group: G3,
		})

		expect((await queue.pop([]))?.priority).toEqual(3)
		expect((await queue.pop([]))?.priority).toEqual(2)
		expect((await queue.pop([]))?.priority).toEqual(1)
		expect((await queue.pop([]))?.priority).toEqual(0)
	})

	it("can do push that changes element's group", async () => {
		const id = generateUUID()
		await queue.push({
			id,
			priority: 2,
			group: G1,
		})
		await queue.push({
			id,
			priority: 1,
			group: G2,
		})
		expect(await queue.peek([G1])).toBeFalsy()
		expect((await queue.peek([G2]))?.priority).toEqual(1)
	})

	// TODO(teawithsand): more tests for storage
}

describe("In-memory storage", () => {
	testStorage(() => new InMemoryEngineStorage())
})

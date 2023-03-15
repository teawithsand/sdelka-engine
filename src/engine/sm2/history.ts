import { generateUUID } from "@teawithsand/tws-stl"
import {
	GroupedQueue,
	GroupedQueueElementPropsExtractor,
} from "../../storage/queue"
import { Clock } from "../clock"
import { SM2EngineCardData } from "./defines"

type SM2EngineHistoryEntry = {
	data: SM2EngineCardData
	index: number
	id: string
}

export const SM2EngineHistoryDataGroupedQueueElementPropsExtractor: GroupedQueueElementPropsExtractor<
	SM2EngineHistoryEntry
> = (data) => ({
	id: data.id,
	group: "",
	priority: data.index,
})

export class SM2EngineHistory {
	constructor(
		public readonly queue: GroupedQueue<SM2EngineHistoryEntry>,
		public readonly clock: Clock,
		public readonly maxHistorySize: number = 250
	) {}

	push = async (data: SM2EngineCardData) => {
		await this.queue.add({
			data,
			index: await this.queue.length([]),
			id: generateUUID(),
		})

		const sz = await this.queue.length([])
		if (sz > this.maxHistorySize) {
			await this.queue.popBack([])
		}
	}

	pop = async (): Promise<SM2EngineCardData | null> => {
		const res = await this.queue.popFront([])
		if (!res) return null

		return res.data
	}

	length = async (): Promise<number> => {
		return await this.queue.length([])
	}
}

import { InMemoryTransactionHelper } from "../../util/transaction"
import {
	GroupedQueue,
	GroupedQueueElementPropsExtractor,
	GroupedQueueRangeLike,
} from "../queue"
import { EngineStorage } from "../storage"

type Data<CD, SD> = {
	sessionData: SD | null
	cardData: {
		[key: string]: CD
	}
	queues: {
		[key: string]: any[]
	}
}

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data))

export class InMemoryEngineStorage<CD, SD> implements EngineStorage<CD, SD> {
	private currentData: Data<CD, SD> = {
		sessionData: null,
		cardData: {},
		queues: {},
	}
	private txHelper = new InMemoryTransactionHelper<Data<CD, SD>>()

	private get dataToUse() {
		return this.txHelper.currentTransactionData ?? this.currentData
	}

	transaction = async <R>(cb: () => Promise<R>): Promise<R> => {
		let newData: Data<CD, SD> | null = null
		const res = await this.txHelper.runWithTransaction(
			clone(this.dataToUse),
			async () => {
				try {
					return await cb()
				} catch (e) {
					throw e
				} finally {
					// if thrown, this should not be used anyway
					newData = this.txHelper.currentTransactionData
				}
			}
		)

		if (!newData) return res

		if (this.txHelper.isInTransaction) {
			this.txHelper.replaceTransactionData(newData)
		} else {
			this.currentData = newData
		}

		return res
	}

	getSessionData = async (): Promise<SD | null> => {
		return this.dataToUse.sessionData
	}

	setSessionData = async (sd: SD) => {
		this.dataToUse.sessionData = sd
	}

	deleteSessionData = async () => {
		this.dataToUse.sessionData = null
	}

	getEngineCardData = async (id: string): Promise<CD | null> => {
		return this.dataToUse.cardData[id] ?? null
	}

	setEngineCardData = async (id: string, data: CD) => {
		this.dataToUse.cardData[id] = data
	}

	deleteEngineCardData = async (id: string) => {
		if (id in this.dataToUse.cardData) {
			delete this.dataToUse.cardData[id]
		}
	}

	getQueue = <D>(
		queueId: string,
		extractor: GroupedQueueElementPropsExtractor<D>
	): GroupedQueue<D> => {
		const getQueueData = (): D[] => {
			if (!this.dataToUse.queues[queueId]) {
				this.dataToUse.queues[queueId] = []
			}
			return this.dataToUse.queues[queueId] as D[]
		}
		const setQueueData = (data: D[]) => {
			this.dataToUse.queues[queueId] = data
		}

		const getSubQueue = (
			groups: string[],
			range?: GroupedQueueRangeLike
		) => {
			let res =
				groups.length === 0
					? getQueueData()
					: getQueueData().filter((e) =>
							groups.includes(extractor(e).group)
					  )
			if (range) {
				const { fromIncl, toIncl } = range
				if (fromIncl !== undefined) {
					res = res.filter((e) => extractor(e).priority >= fromIncl)
				}

				if (toIncl !== undefined) {
					res = res.filter((e) => extractor(e).priority <= toIncl)
				}
			}

			return res
		}

		return {
			extractor,
			toArray: async () => [...getQueueData()],
			clear: async (groups: string[]) => {
				if (groups.length === 0) {
					setQueueData([])
				} else {
					setQueueData(
						getQueueData().filter(
							(e) => !groups.includes(extractor(e).group)
						)
					)
				}
			},
			length: async (groups, ranges) => {
				return getSubQueue(groups, ranges).length
			},
			peekFront: async (groups, ranges) => {
				const elements = getSubQueue(groups, ranges)
				if (elements.length === 0) return null
				return elements[0]
			},
			popFront: async (groups, ranges) => {
				const elements = getSubQueue(groups, ranges)
				if (elements.length === 0) return null
				const res = elements[0]

				const i = getQueueData().findIndex(
					(e) => extractor(e).id === extractor(res).id
				)
				getQueueData().splice(i, 1)

				return res
			},
			peekBack: async (groups, ranges) => {
				const elements = getSubQueue(groups, ranges)
				if (elements.length === 0) return null
				return elements[elements.length - 1]
			},
			popBack: async (groups, ranges) => {
				const elements = getSubQueue(groups, ranges)
				if (elements.length === 0) return null
				const res = elements[elements.length - 1]

				const i = getQueueData().findIndex(
					(e) => extractor(e).id === extractor(res).id
				)
				getQueueData().splice(i, 1)

				return res
			},
			add: async (element) => {
				// Single element with given id may exist in queue
				const i = getQueueData().findIndex(
					(e) => extractor(e).id === extractor(element).id
				)
				if (i >= 0) getQueueData().splice(i, 1)

				getQueueData().push(element)
				getQueueData().sort(
					(a, b) => -(extractor(a).priority - extractor(b).priority)
				)
			},
			hasId: async (id: string) => {
				return !!getQueueData().find((e) => extractor(e).id === id)
			},
			getId: async (id: string) => {
				return (
					getQueueData().find((e) => extractor(e).id === id) ?? null
				)
			},
			deleteId: async (id: string) => {
				const i = getQueueData().findIndex(
					(e) => extractor(e).id === id
				)
				if (i < 0) return
				getQueueData().splice(i, 1)
				return
			},
		}
	}
}

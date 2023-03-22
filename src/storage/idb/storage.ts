import {
	GroupedQueue,
	GroupedQueueElementPropsExtractor
} from "../queue"
import { EngineStorage } from "../storage"
import { IDBStorageDB } from "./db"

/**
 * EngineStorage, which utilizes IndexedDB.
 */
export class IDBEngineStorage<CD, SD> implements EngineStorage<CD, SD> {
	constructor(
		private readonly db: IDBStorageDB<CD, SD>,
		private readonly session: string
	) {}
	transaction = async <R>(cb: () => Promise<R>): Promise<R> => {
		return await this.db.transaction(
			"rw",
			[this.db.sessions, this.db.cards, this.db.queues],
			async () => await cb()
		)
	}
	getSessionData = async (): Promise<SD | null> => {
		return (await this.db.sessions.get(this.session))?.value ?? null
	}
	setSessionData = async (sd: SD): Promise<void> => {
		await this.db.sessions.put({
			session: this.session,
			value: sd,
		})
	}
	deleteSessionData = async (): Promise<void> => {
		await this.db.sessions.where("session").equals(this.session).delete()
	}
	getEngineCardData = async (id: string): Promise<CD | null> => {
		return (await this.db.cards.get(id))?.value ?? null
	}
	setEngineCardData = async (id: string, data: CD): Promise<void> => {
		await this.db.cards.put({
			id,
			session: this.session,
			value: data,
		})
	}
	deleteEngineCardData = async (id: string): Promise<void> => {
		await this.db.cards.where("[session+id]").equals([this.session, id])
	}
	getQueue = <D>(
		queueName: string,
		extractor: GroupedQueueElementPropsExtractor<D>
	): GroupedQueue<D> => {
		return {
			extractor,

			add: async (e) => {
				const v = extractor(e)
				await this.db.pushQueueElement({
					id: v.id,
					session: this.session,
					group: v.group,
					name: queueName,
					priority: v.priority,
					data: e,
				})
			},
			peekFront: async (groups, priorityRange) => {
				return ((
					await this.db.getQueueTopElement(
						this.session,
						queueName,
						groups,
						priorityRange
					)
				)?.data ?? null) as D | null
			},
			peekBack: async (groups, priorityRange) => {
				return ((
					await this.db.getQueueBottomElement(
						this.session,
						queueName,
						groups,
						priorityRange
					)
				)?.data ?? null) as D | null
			},
			popFront: async (groups, priorityRange) => {
				return await this.db.transaction(
					"rw?",
					[this.db.queues],
					async () => {
						const element = await this.db.getQueueTopElement(
							this.session,
							queueName,
							groups,
							priorityRange
						)
						if (!element) return null
						await this.db.deleteQueueElement(
							this.session,
							queueName,
							element.id
						)
						return element.data as D
					}
				)
			},
			popBack: async (groups, priorityRange) => {
				return await this.db.transaction(
					"rw?",
					[this.db.queues],
					async () => {
						const element = await this.db.getQueueBottomElement(
							this.session,
							queueName,
							groups,
							priorityRange
						)
						if (!element) return null
						await this.db.deleteQueueElement(
							this.session,
							queueName,
							element.id
						)
						return element.data as D
					}
				)
			},
			clear: async (groups) => {
				await this.db.clearQueue(this.session, queueName, groups)
			},
			length: async (groups, priorityRange) => {
				return await this.db.getQueueLength(
					this.session,
					queueName,
					groups,
					priorityRange
				)
			},

			hasId: async (id: string) => {
				return !!(await this.db.getQueueElementById(
					this.session,
					queueName,
					id
				))
			},
			getId: async (id: string) => {
				return ((
					await this.db.getQueueElementById(
						this.session,
						queueName,
						id
					)
				)?.data ?? null) as D | null
			},
			deleteId: async (id) => {
				await this.db.deleteQueueElement(this.session, queueName, id)
			},
			toArray: async (groups) => {
				return (
					await this.db.getQueueToArray(
						this.session,
						queueName,
						groups
					)
				).map((v) => v.data as D)
			},
		}
	}
}

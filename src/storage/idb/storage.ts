import Dexie, { Table } from "dexie"
import {
	IDBComparable,
	idbComparator,
	MAX_IDB_KEY,
	MIN_IDB_KEY,
} from "../../pubutil"
import { dispatchRange } from "../../util/range"
import {
	GroupedQueue,
	GroupedQueueElementPropsExtractor,
	GroupedQueueRangeLike,
} from "../queue"
import { EngineStorage } from "../storage"

type SessionStorageEntry<SD> = {
	session: string // in fact session could be id, but whatever
	value: SD
}

type CardStorageEntry<SD> = {
	id: string
	session: string

	value: SD
}

type QueueEntry = {
	id: string
	session: string

	name: string
	group: string
	priority: IDBComparable

	data: any
}

/**
 * Have I mentioned that I dislike IDB?
 *
 * Let the queries in this class tell you why. Just imagine how each one would look in SQL...
 * The main PITA is that there is no something like IN, you can only query ranges.
 *
 * This class represents DB that contains CD/SD of some type, but actually it's per-session,
 * so you can easily force cast this to some other DB type. Just make sure each session id
 * has the very same data type.
 *
 * This class is to-be-used by IDBEngineStorage. You probably do not want to use it on it's own.
 * It's also subject to more frequent changes compared to EngineStorage.
 */
export class IDBStorageDB<CD, SD> extends Dexie {
	public readonly sessions!: Table<SessionStorageEntry<SD>, string>
	public readonly cards!: Table<CardStorageEntry<CD>, string>
	public readonly queues!: Table<QueueEntry, string>

	constructor(name: string) {
		super(name)
		this.version(1).stores({
			sessions: "session",
			cards: "[session+id]",
			queues: "[session+name+id], session, [session+name], [session+name+group], [session+name+priority], [session+name+group+priority]",
		})
	}

	clearAllSessionData = async (session: string) => {
		await this.transaction(
			"rw?",
			[this.sessions, this.cards, this.queues],
			async () => {
				await this.sessions.where("session").equals([session]).delete()
				await this.cards.where("session").equals([session]).delete()
				await this.queues.where("session").equals([session]).delete()
			}
		)
	}

	clearQueue = async (session: string, queue: string, groups: string[]) => {
		if (groups.length) {
			for (const group of groups) {
				await this.queues
					.where("[session+name+group]")
					.equals([session, queue, group])
					.delete()
			}
		} else {
			await this.queues
				.where("[session+name]")
				.equals([session, queue])
				.delete()
		}
	}

	deleteQueueElement = async (session: string, queue: string, id: string) => {
		await this.queues
			.where("[session+name+id]")
			.equals([session, queue, id])
			.delete()
	}

	pushQueueElement = async (qe: QueueEntry): Promise<void> => {
		await this.queues.put(qe)
	}

	getQueueElementById = async (
		session: string,
		queue: string,
		id: string
	): Promise<QueueEntry | null> => {
		return (
			(await this.queues
				.where("[session+name+id]")
				.equals([session, queue, id])
				.first()) ?? null
		)
	}

	getQueueLength = async (
		session: string,
		queue: string,
		groups: string[],
		priorityRangeRaw?: GroupedQueueRangeLike
	) => {
		let count = 0

		const priorityRange = dispatchRange(priorityRangeRaw ?? {}, {
			toIncl: MAX_IDB_KEY,
			fromIncl: MIN_IDB_KEY,
		})

		if (groups.length) {
			// You may have guessed this one already.
			///
			// There is no way to do SQL "IN" in idb...
			// You may only do "ranges" and there is no way to be sure that no group that you wouldn't want
			// to include fall into range that you want to query.
			//
			// This isn't be a problem as long as there aren't too many groups.

			for (const g of groups) {
				count += await this.queues
					.where("[session+name+group+priority]")
					.between(
						// yes, you may not leave last entry empty. You have to use tuple that
						// exactly matches one used in index.
						// Otherwise results won't be sorted by last field.
						[session, queue, g, priorityRange.from],
						[session, queue, g, priorityRange.to],
						priorityRange.fromIncl,
						priorityRange.toIncl
					)
					.count()
			}
		} else {
			count += await this.queues
				.where("[session+name+priority]")
				.between(
					[session, queue, priorityRange.from],
					[session, queue, priorityRange.to],
					priorityRange.fromIncl,
					priorityRange.toIncl
				)
				.count()
		}

		return count
	}

	/**
	 * Get specified queue's top element.
	 *
	 * It's cost is: log(n) * groups.length.
	 */
	getQueueTopElement = async (
		session: string,
		queue: string,
		groups: string[],
		priorityRangeRaw?: GroupedQueueRangeLike
	): Promise<QueueEntry | null> => {
		let candidates = []

		const priorityRange = dispatchRange(priorityRangeRaw ?? {}, {
			toIncl: MAX_IDB_KEY,
			fromIncl: MIN_IDB_KEY,
		})

		if (groups.length) {
			// You may have guessed this one already.
			///
			// There is no way to do SQL "IN" in idb...
			// You may only do "ranges" and there is no way to be sure that no group that you wouldn't want
			// to include fall into range that you want to query.
			//
			// This isn't be a problem as long as there aren't too many groups.

			for (const group of groups) {
				const element = await this.queues
					.where("[session+name+group+priority]")
					.between(
						// yes, you may not leave last entry empty. You have to use tuple that
						// exactly matches one used in index.
						// Otherwise results won't be sorted by last field.
						[session, queue, group, priorityRange.from],
						[session, queue, group, priorityRange.to],
						priorityRange.fromIncl,
						priorityRange.toIncl
					)
					.last()
				if (element) candidates.push(element)
			}
		} else {
			const element = await this.queues
				.where("[session+name+priority]")
				.between(
					[session, queue, priorityRange.from],
					[session, queue, priorityRange.to],
					priorityRange.fromIncl,
					priorityRange.toIncl
				)
				.last()
			if (element) candidates.push(element)
		}

		candidates.sort((a, b) => -idbComparator(a.priority, b.priority))
		return candidates.length ? candidates[0] : null
	}

	getQueueBottomElement = async (
		session: string,
		queue: string,
		groups: string[],
		priorityRangeRaw?: GroupedQueueRangeLike
	): Promise<QueueEntry | null> => {
		let candidates = []

		const priorityRange = dispatchRange(priorityRangeRaw ?? {}, {
			toIncl: MAX_IDB_KEY,
			fromIncl: MIN_IDB_KEY,
		})

		if (groups.length) {
			// You may have guessed this one already.
			///
			// There is no way to do SQL "IN" in idb...
			// You may only do "ranges" and there is no way to be sure that no group that you wouldn't want
			// to include fall into range that you want to query.
			//
			// This isn't be a problem as long as there aren't too many groups.

			for (const group of groups) {
				const element = await this.queues
					.where("[session+name+group+priority]")
					.between(
						// yes, you may not leave last entry empty. You have to use tuple that
						// exactly matches one used in index.
						// Otherwise results won't be sorted by last field.
						[session, queue, group, priorityRange.from],
						[session, queue, group, priorityRange.to],
						priorityRange.fromIncl,
						priorityRange.toIncl
					)
					.first()
				if (element) candidates.push(element)
			}
		} else {
			const element = await this.queues
				.where("[session+name+priority]")
				.between(
					[session, queue, priorityRange.from],
					[session, queue, priorityRange.to],
					priorityRange.fromIncl,
					priorityRange.toIncl
				)
				.first()
			if (element) candidates.push(element)
		}

		candidates.sort((a, b) => idbComparator(a.priority, b.priority))
		return candidates.length ? candidates[0] : null
	}

	getQueueToArray = async (
		session: string,
		queue: string,
		groups: string[],
		priorityRangeRaw?: GroupedQueueRangeLike
	): Promise<QueueEntry[]> => {
		let candidates: QueueEntry[] = []

		const priorityRange = dispatchRange(priorityRangeRaw ?? {}, {
			toIncl: MAX_IDB_KEY,
			fromIncl: MIN_IDB_KEY,
		})

		if (groups.length) {
			// You may have guessed this one already.
			///
			// There is no way to do SQL "IN" in idb...
			// You may only do "ranges" and there is no way to be sure that no group that you wouldn't want
			// to include fall into range that you want to query.
			//
			// This isn't be a problem as long as there aren't too many groups.

			for (const g of groups) {
				const element = await this.queues
					.where("[session+name+group+priority]")
					.between(
						// yes, you may not leave last entry empty. You have to use tuple that
						// exactly matches one used in index.
						// Otherwise results won't be sorted by last field.
						[session, queue, g, priorityRange.from],
						[session, queue, g, priorityRange.to],
						priorityRange.fromIncl,
						priorityRange.toIncl
					)
					.toArray()
				candidates = [...candidates, ...element]
			}
		} else {
			const element = await this.queues
				.where("[session+name+priority]")
				.between(
					[session, queue, priorityRange.from],
					[session, queue, priorityRange.to],
					priorityRange.fromIncl,
					priorityRange.toIncl
				)
				.toArray()
			candidates = [...candidates, ...element]
		}

		candidates.sort((a, b) => -idbComparator(a.priority, b.priority))
		return candidates
	}
}

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

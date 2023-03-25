import Dexie, { Table } from "dexie"
import { IDBComparable, idbComparator, MAX_IDB_KEY, MIN_IDB_KEY } from "../../pubutil"
import { dispatchRange } from "../../util/range"
import { GroupedQueueRangeLike } from "../queue"

export type SessionStorageEntryDBEntity<SD> = {
	session: string // in fact session could be id, but whatever
	value: SD
}

export type CardStorageEntryDBEntity<SD> = {
	id: string
	session: string

	value: SD
}

export type QueueEntryDBEntity = {
	id: string
	session: string

	name: string
	group: string
	priority: IDBComparable

	data: any
}

export type CardCollectionEntryDBEntity = {
	id: string
	collectionId: string
	version: number

    data: any
}

/**
 * Have I mentioned that I dislike IndexedDB?
 *
 * Let the queries in this class tell you why. Just imagine how each one would look in SQL...
 * The main PITA is that there is no something like IN, you can only query ranges AND you
 * may only walk through single tree/index at the time.
 *
 * This class represents DB that contains CD/SD of some type, but actually it's per-session,
 * so you can easily force cast this to some other DB type. Just make sure each session id
 * has the very same data type.
 *
 * This class is to-be-used by IDBEngineStorage. You probably do not want to use it on it's own.
 * It's also subject to more frequent changes compared to EngineStorage.
 */
export class IDBStorageDB<CD, SD> extends Dexie {
	// TODO(teawithsand): get rid of these generic types; replace them with any 
	//  directly in underlying types

	public readonly sessions!: Table<SessionStorageEntryDBEntity<SD>, string>
	public readonly cards!: Table<CardStorageEntryDBEntity<CD>, string>
	public readonly queues!: Table<QueueEntryDBEntity, string>

	public readonly cardCollectionEntries!: Table<CardCollectionEntryDBEntity>

	constructor(name: string) {
		super(name)
		this.version(1).stores({
			sessions: "session",
			cards: "[session+id]",
			queues: "[session+name+id], session, [session+name], [session+name+group], [session+name+priority], [session+name+group+priority]",
			
			cardCollectionEntries: "[collectionId+id], [collectionId+version]",
		})
	}

	// TODO(teawithsand): separate method used to manage EngineStorage and CardSource
	//  create readonly scope objects capturing each of these groups of entries

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

	pushQueueElement = async (qe: QueueEntryDBEntity): Promise<void> => {
		await this.queues.put(qe)
	}

	getQueueElementById = async (
		session: string,
		queue: string,
		id: string
	): Promise<QueueEntryDBEntity | null> => {
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
	): Promise<QueueEntryDBEntity | null> => {
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
	): Promise<QueueEntryDBEntity | null> => {
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
	): Promise<QueueEntryDBEntity[]> => {
		let candidates: QueueEntryDBEntity[] = []

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

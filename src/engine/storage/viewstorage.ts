import produce from "immer"
import {
	CardCollectionAccess,
	DBCollectionsStore,
	EngineEntriesView
} from "../../store"
import {
	EngineEntryData,
	EngineEntryDataEntity,
	EngineHistoryData,
	EngineCollectionData,
} from "../defines"
import { EngineStorage } from "./storage"
import { IDBComparable } from "../../util"

export class DBEngineStorage implements EngineStorage {
	constructor(
		private readonly db: DBCollectionsStore,
		private readonly view: EngineEntriesView,
		private readonly collectionAccess: CardCollectionAccess
	) {}

	transaction = this.db.transaction

	setSessionData = async (data: EngineCollectionData) => {
		await this.collectionAccess.updateEngineData(data)
	}
	getSessionData = async () => {
		return (await this.collectionAccess.getData())?.engineData ?? null
	}

	getTopEntryOnQueue = async (
		queues: IDBComparable[]
	): Promise<EngineEntryDataEntity | null> => {
		return await this.transaction(async () => {
			const id = await this.view.getTopmostQueueEntry(queues)
			if (id === null) return null

			const data = (await this.view.getData(id))?.engineData
			if (!data) return null

			return {
				id,
				data,
			}
		})
	}

	getQueueLengthInRange = this.view.getQueueLengthInRange

	setEngineData = async (
		id: string,
		data: EngineEntryData
	): Promise<void> => {
		await this.transaction(async () => {
			const access = await this.view.getAccess(id)
			if (!access) return

			// This is ok
			// as this storage is used exclusively for engine
			data = produce(data, (draft) => {
				draft.isOutOfSync = true
			})
			await access.updateEngineData(data)
		})
	}

	getEngineData = async (
		id: string
	): Promise<EngineEntryDataEntity | null> => {
		const data = (await this.view.getData(id))?.engineData
		if (!data) return null

		return {
			id,
			data,
		}
	}

	pushHistoryEntry = async (data: EngineHistoryData): Promise<void> => {
		await this.collectionAccess.pushHistoryEntry(data)
	}

	peekHistoryEntry = async (): Promise<EngineHistoryData | null> => {
		return await this.collectionAccess.peekHistoryEntry()
	}

	popHistoryEntry = async (): Promise<void> => {
		await this.collectionAccess.popHistoryEntry()
	}
}

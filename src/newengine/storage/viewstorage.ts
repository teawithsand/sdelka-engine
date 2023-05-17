import {
	DBCollectionAccess,
	DBCollectionsStore,
	EngineEntriesView,
} from "../../newstore"
import { IDBComparable } from "../../pubutil"
import {
	EngineSessionData,
	EngineEntryDataEntity,
	EngineEntryData,
	EngineHistoryData,
} from "../defines"
import { EngineStorage } from "./storage"

export class DBEngineStorage implements EngineStorage {
	constructor(
		private readonly db: DBCollectionsStore<
			EngineEntryData,
			any,
			any,
			EngineSessionData,
			EngineHistoryData
		>,
		private readonly view: EngineEntriesView<EngineEntryData, any>,
		private readonly collectionAccess: DBCollectionAccess<
			any,
			EngineSessionData,
			EngineHistoryData
		>
	) {}

	transaction = this.db.transaction
	
	setSessionData = async (data: EngineSessionData) => {
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

	setEngineData = async (
		id: string,
		data: EngineEntryData
	): Promise<void> => {
		await this.transaction(async () => {
			const access = await this.view.getAccess(id)
			if (!access) return
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

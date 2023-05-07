import Dexie from "dexie"
import { MAX_IDB_KEY, MIN_IDB_KEY } from "../comparator"
import { generateUUID } from "../../util/stl"

export type WalActionData<T> = {
	id: string
	scope: string
	offset: number
	data: T
}

export type WalExecutor<T> = (command: T) => Promise<void>

/**
 * PNP write-ahead-logging scheme using IDB transactions to ensure consistency of operations performed
 * across multiple IDB databases.
 *
 * It supports pushing multiple actions to-be-executed onto it, although it's advised not to do so.
 *
 * It can be used with either external(3rd party) or in-db table with any name.
 */
export class IDBWalHelper<T> {
	public static readonly walTableIndexSpec = "id, [scope+offset]"

	public constructor(
		private readonly db: Dexie,
		private readonly table: Dexie.Table<WalActionData<T>>,
		private readonly executor: WalExecutor<T>,
		private readonly scope: string = "default"
	) {}

	ensureWallEmpty = async () => {
		const entries = await this.table
			.where("[scope+offset]")
			.between(
				[this.scope, MIN_IDB_KEY],
				[this.scope, MAX_IDB_KEY],
				true,
				true
			)
			.toArray()

		// most of the times, only one action will be there in wall anyway

		for (const e of entries) {
			await this.executor(e.data)
			await this.table.delete(e.id)
		}
	}

	addAction = async (data: T) => {
		await this.ensureWallEmpty()
		await this.table.put({
			id: generateUUID(),
			scope: this.scope,
			data,
			offset: 0,
		})
		await this.ensureWallEmpty()
	}
}

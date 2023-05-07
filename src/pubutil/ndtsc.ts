import Dexie from "dexie"
import { NDTSC_BASE } from "../util/sync"

export type NDTSCData = {
	scope: string
	value: number
}
/**
 * NDTSC helper, which works with transaction of DB it's running on top of.
 */
export class IndexedDBNdtscHelper {
	public static readonly ndtscTableSpec = "scope"

	public constructor(
		private readonly db: Dexie,
		private readonly table: Dexie.Table<NDTSCData>,
		private readonly scope: string = "default"
	) {}

	getAndIncrement = async (): Promise<number> => {
		const data = await this.table.get(this.scope)
		const value = data?.value ?? NDTSC_BASE

		await this.table.put({
			scope: this.scope,
			value: value + 1,
		})

		return value
	}
}

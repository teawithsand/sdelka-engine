import Dexie, { Table } from "dexie"
import { WalActionData, IDBWalHelper, WalExecutor } from "./idbWal"

export class IndexedDBWallDB extends Dexie {
	public readonly wall!: Table<WalActionData<any>>

	constructor(name: string) {
		super(name)

		this.version(1).stores({
			wall: IDBWalHelper.walTableIndexSpec,
		})
	}

    /**
     * Gets wall with specified scope and action type.
     * It's user responsibility not to allow any within-single-scope type mixing problems.
     */
	getWall = <T>(
		scope: string,
		executor: WalExecutor<T>
	): IDBWalHelper<T> => {
		return new IDBWalHelper(
			this,
			this.wall as Table<WalActionData<T>>,
			executor,
			scope
		)
	}
}

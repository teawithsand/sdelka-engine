import Dexie from "dexie"

export class IndexedDBSyncDataStore extends Dexie {
	constructor(name: string) {
		super(name)
		this.version(1).stores({})
	}
}

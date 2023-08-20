
/**
 * Type, which can be used as IDB key.
 *
 * Note: typed arrays should also be on this list, but I
 */
export type IDBComparable = number | string | Date | IDBComparable[]

const typeList = ["number", "date", "string", "array"]

const getIdbType = (c: IDBComparable) => {
	if (typeof c === "number") return "number"
	if (c instanceof Array) return "array"
	if (c instanceof Date) return "date"
	if (typeof c === "string") return "string"
	throw new Error("Unreachable code")
}

/**
 * Comparator, which behaves like IDB cursor walking over and index.
 */
export const idbComparator = (a: IDBComparable, b: IDBComparable): number => {
	const aType = typeList.indexOf(getIdbType(a))
	const bType = typeList.indexOf(getIdbType(b))

	if (aType < bType) {
		return -1
	} else if (aType > bType) {
		return 1
	}

	if (typeof a === "number" && typeof b === "number") {
        if(a < b) return -1
        if(a > b) return 1
		return 0 // can't subtract, since Infinity - Infinity is NaN, but we want them to be equal
	} else if (typeof a === "string" && typeof b === "string") {
		return a.localeCompare(b)
	} else if (a instanceof Date && b instanceof Date) {
		return a.getTime() - b.getTime()
	} else if (a instanceof Array && b instanceof Array) {
		let sz = Math.min(a.length, b.length)
		for (let i = 0; i < sz; i++) {
			const res = idbComparator(a[i], b[i])
			if (res !== 0) return res
		}

		return a.length - b.length
	}

	throw new Error("Unreachable code")
}

/**
 * @deprecated This causes dexie to trigger weird serialization bug sometimes, however replacing
 * it with new instance of [[]], which maxKey actually is, fixes it.
 */
export const MAX_IDB_KEY: IDBComparable = [[]] //Dexie.maxKey as IDBComparable
export const MIN_IDB_KEY: IDBComparable = -Infinity //Dexie.minKey as IDBComparable

export const maxIdbKey = (): IDBComparable => [[]]
export const minIdbKey = () => MIN_IDB_KEY

export const IDB_LIMIT_INF = 2**32 - 1
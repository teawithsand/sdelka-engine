export * from "./time"
export * from "./comparator"
export * from "./cursor"
export * from "./wal"
export * from "./ndtsc"
export * from "./clock"

export const filterNotNull = <T>(arr: (T | null)[]): T[] => {
	return arr.filter((c) => c !== null) as T[]
}

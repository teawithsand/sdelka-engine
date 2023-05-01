/**
 * Cursor, which iterates over data of type T.
 */
export interface Cursor<T> {
	readonly currentValue: T | null

	/**
	 * Nulls-out currentId if card with given id was removed.
	 *
	 * It DOES NOT reset position of this cursor.
	 */
	refresh: () => Promise<void>
	next: () => Promise<boolean>

	/**
	 * Moves cursor n times forward. Returns amount of ids it was moved forward by.
	 * It's semantically identical to calling next specified amount of times, but it's designed to be faster.
	 */
	advance: (n: number) => Promise<number>

	/**
	 * Returns how many entries are there left to be iterated over by this cursor.
	 */
	left: () => Promise<number>
}

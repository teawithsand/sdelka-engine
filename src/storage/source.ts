import { CardId } from "./storage"

export interface CardSourceCursor {
	readonly currentId: CardId | null
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

	/**
	 * Clones this cursor, so that one of them may be moved further, while previous position can be stored.
	 */
	clone: () => this
}

export interface CardSource<T> {
	getCard: (cardId: CardId) => Promise<T | null>

	serializeCursor: (cursor: CardSourceCursor) => any
	deserializeCursor: (data: any) => CardSourceCursor

	newCursor: () => CardSourceCursor
}

/**
 * CardSource, which may have cards deleted from and appended to.
 */
export interface AppendDeleteCardSource<T> extends CardSource<T> {
	append: (data: T) => Promise<void>
	delete: (id: CardId) => Promise<void>
}

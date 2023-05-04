import { CardId } from "../engine/storage/storage"

/**
 * Cursor, which iterates over cards, yielding their ids.
 * 
 * Right now cursor is not allowed to yield same id twice, but it's subject to change in future.
 */
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
export interface MutableCardSource<T> extends CardSource<T> {
	// TODO(teawithsand): function for bringing card to the end(like it was deleted and then appended)

	append: (data: T) => Promise<void>
	delete: (id: CardId) => Promise<void>

	/**
	 * Disposes all resources associated with that source.
	 * Any kind of cursor, which was associated with it should be used no more, as it's UB.
	 * 
	 * If this source has metadata associated with it, it also gets cleared.
	 */
	clear: () => Promise<void>
}

/**
 * Card source capable of storing metadata about whole collection of cards.
 */
export interface MetadataCardSource<T, M> extends CardSource<T> {
	/**
	 * Returns last set metadata, or null if none is set.
	 */
	getMetadata: () => Promise<M | null>
	
	/**
	 * Sets metadata of this source.
	 */
	setMetadata: (metadata: M) => Promise<void>
}

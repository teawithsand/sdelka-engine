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

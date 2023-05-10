import { Cursor } from "../pubutil"
import { EmbeddedSyncData, NDTSC } from "../util/sync"

// Each card is externally identified by key - externally set user property

/**
 * Data extracted from stored cards, which runs
 */
export interface ExtractedCardData {
	id: string
	collectionId: string
	tags: string[]

	priority: number
	syncData: EmbeddedSyncData
}

export type CardDataExtractor<T> = (card: T) => ExtractedCardData

export interface ExtractedCollectionData {
	id: string
	cardModifyNdtsc: NDTSC
}

export type CollectionDataExtractor<T> = (card: T) => ExtractedCollectionData

export type CardFilter = {
	hasTag?: string
}

export interface CardCollectionStorage<T, C> {
	transaction: <R>(callback: () => Promise<R>) => Promise<R>

	putCollection: (collectionData: T) => Promise<void>
	deleteCollection: (id: string) => Promise<void>
	getCollections: () => Cursor<T>

	getCollectionCards: (id: string) => Promise<CardStorage<C>>
}

/**
 * New card storage. Now it's only DB, as syncing with engine storage is performed using WAL.
 */
export interface CardStorage<T> {
	transaction: <R>(callback: () => Promise<R>) => Promise<R>

	getCard: (cardId: string) => Promise<T | null>
	deleteCard: (cardId: string) => Promise<void>
	putCard: (cardData: T) => Promise<void>

	getCards: (filter: CardFilter) => Cursor<T>
}

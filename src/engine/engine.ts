import { Draft } from "immer"

/**
 * Engine, which like SM2 engine uses key/value+features DB to run whole learning process.
 *
 * Such databases are easy to synchronize between devices and synchronization is the main purpose of existence
 * of this interface.
 */
export interface CardDataBasedEngineManagement<T> {
	getEngineCardData: (id: string) => Promise<T | null>
	setEngineCardData: (id: string, data: T) => Promise<void>
	hasEngineCardData: (id: string) => Promise<boolean>
}

/**
 * Engine, which has cards manually deleted/added to it.
 */
export interface CardEngineManagement {
	hasCard: (id: string) => Promise<boolean>
	addCard: (id: string, priority?: number) => Promise<void>
	deleteCard: (id: string) => Promise<void>
}

export interface RuntimeConfigurableEngine<C> {
	setRuntimeConfig: (config: C) => Promise<void>
	updateRuntimeConfig: (cb: (draft: Draft<C>) => void) => Promise<void>
	getRuntimeConfig: () => Readonly<C>
}

/**
 * Abstract type representing any engine.
 *
 * TODO(teawithsand): replace parameter T with string
 */
export interface Engine<T, A, S> {
	getCurrentCard: () => Promise<T | null>
	answer: (answer: A) => Promise<void>
	getStats: () => Promise<S>
}

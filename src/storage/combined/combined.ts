import { CardSource, CardSourceCursor } from "../source"

interface CombinedCardSourceCursorData {
	currentId: string | null
	currentSourceId: string | null
}

interface SerializedCombinedCardSourceCursorData
	extends CombinedCardSourceCursorData {
	serializedCursors: {
		[id: string]: any
	}
}

type CursorWrapper<T> = {
	source: CardSource<T>
	cursor: CardSourceCursor
	sourceId: string
}

class CombinedCardSourceCursor<T> implements CardSourceCursor {
	constructor(
		public data: CombinedCardSourceCursorData,
		public readonly cursors: Readonly<Readonly<CursorWrapper<T>>[]>,
		public readonly source: CombinedCardSource<T>
	) {}
	refresh = async (): Promise<void> => {
		for (const c of this.cursors) {
			await c.cursor.refresh()
			if (
				c.sourceId === this.data.currentSourceId &&
				c.cursor.currentId !== this.data.currentId
			) {
				this.data.currentId = c.cursor.currentId
			}
		}
	}

	get currentId(): string | null {
		if (this.data.currentId === null) return null
		return `${this.data.currentSourceId}/${this.data.currentId}`
	}

	next = async (): Promise<boolean> => {
		for (const c of this.cursors) {
			const res = await c.cursor.next()
			if (res) {
				this.data.currentId = c.cursor.currentId
				this.data.currentSourceId = c.sourceId
				return true
			}
		}

		return false
	}
}

export type CombinedCardSourceSource<T> = {
	source: CardSource<T>
	sourceId: string
	offset?: number
}

export class CombinedCardSource<T> implements CardSource<T> {
	/**
	 *
	 * @param sources List of sources to take cards from. It's order matters, so it can't be map.
	 */
	constructor(private readonly sources: CombinedCardSourceSource<T>[]) {
		this.sources = [...sources]
		// note: this sort has to be stable in order for this to work
		this.sources.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0))
		const ids = new Set<string>()
		for (const s of sources) {
			if (ids.has(s.sourceId))
				throw new Error(
					`ID ${s.sourceId} exists two or more times in passed source set`
				)
			ids.add(s.sourceId)
		}
	}

	getCard = async (rawCardId: string): Promise<T | null> => {
		if (!rawCardId.includes("/")) return null

		const [sourceId, cardId] = rawCardId.split("/", 2)

		const source = this.sources.find((s) => s.sourceId === sourceId)
		if (!source) return null

		return source.source.getCard(cardId)
	}

	newCursor = (): CardSourceCursor => {
		return new CombinedCardSourceCursor(
			{
				currentSourceId: null,
				currentId: null,
			},
			this.sources.map((s) => ({
				source: s.source,
				cursor: s.source.newCursor(),
				sourceId: s.sourceId,
			})),
			this
		)
	}

	serializeCursor = (cursor: CardSourceCursor) => {
		if (
			!(cursor instanceof CombinedCardSourceCursor) ||
			cursor.source !== this
		) {
			throw new Error(`Cursor given does not belong to this source`)
		}
		const data: SerializedCombinedCardSourceCursorData = {
			...cursor.data,
			serializedCursors: Object.fromEntries(
				cursor.cursors.map((c) => [
					c.sourceId,
					c.source.serializeCursor(c.cursor),
				])
			),
		}

		return data
	}

	deserializeCursor = (data: any): CardSourceCursor => {
		const casted = data as SerializedCombinedCardSourceCursorData

		const cursors: CursorWrapper<T>[] = []

		const serializedCursorsLength = [
			...Object.keys(casted.serializedCursors),
		].length
		if (this.sources.length !== serializedCursorsLength) {
			throw new Error(
				`Sources and serialized cursor data serialized cursors mismatch; expected ${this.sources.length} got ${serializedCursorsLength}`
			)
		}

		for (const source of this.sources) {
			const serializedData = casted.serializedCursors[source.sourceId]
			if (!serializedData) {
				throw new Error(
					`Serialized data mismatch - it does not contain cursor with source id = ${source.sourceId}`
				)
			}

			const cursor = source.source.deserializeCursor(serializedData)

			cursors.push({
				cursor: cursor,
				sourceId: source.sourceId,
				source: source.source,
			})
		}

		return new CombinedCardSourceCursor(
			{
				currentSourceId: casted.currentSourceId,
				currentId: casted.currentId,
			},
			cursors,
			this
		)
	}
}

/**
 * Cursor, which iterates over data of type T.
 *
 * In it's most basic form data may not be modified while it's performing iteration.
 */
export interface Cursor<T> {
	readonly currentValue: T | null

	/**
	 * Returns amount of entries processed INCLUDING current value.
	 */
	position: () => number

	next: () => Promise<boolean>

	/**
	 * Moves cursor n times forward. Returns amount of ids it was moved forward by.
	 */
	advance: (n: number) => Promise<void>

	/**
	 * Returns how many entries are there left to be iterated over by this cursor.
	 */
	left: () => Promise<number>
}

export class AsyncCursor<T> implements Cursor<T> {
	private offset = 0
	private currentChunk: T[] = []
	private innerCurrentValue: T | null = null

	constructor(
		private readonly adapter: {
			fetch: (offset: number, limit: number) => Promise<T[]>
			left: (offset: number) => Promise<number>
		},
		private readonly batchSize = 30
	) {}

	position = (): number => {
		return this.offset
	}

	get currentValue(): T | null {
		return this.innerCurrentValue
	}

	next = async (): Promise<boolean> => {
		if (this.currentChunk.length === 0) {
			this.currentChunk = await this.adapter.fetch(
				this.offset,
				this.batchSize
			)
			this.currentChunk.reverse()
		}

		if (this.currentChunk.length > 0) {
			this.innerCurrentValue = this.currentChunk.pop() ?? null
			this.offset++
			return true
		}

		return false
	}
	advance = async (n: number): Promise<void> => {
		if (n <= 0) {
			return
		}

		this.currentChunk = []
		this.offset += n - 1
		await this.next()

		return
	}

	left = async (): Promise<number> => {
		return await this.adapter.left(this.offset)
	}
}

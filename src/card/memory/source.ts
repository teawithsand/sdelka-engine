import {
	MutableCardSource,
	CardSource,
	CardSourceCursor,
	MetadataCardSource,
} from "../source"

type Entry<T> = {
	data: T
	version: number
}

interface Access {
	readonly entries: Entry<{ readonly id: string }>[]
}

interface InMemoryCursorData {
	lastLoadedVersion: number | null
	currentId: string | null
}

class InMemoryCardSourceCursor<T extends { readonly id: string }, M>
	implements CardSourceCursor
{
	constructor(
		public data: InMemoryCursorData,
		public readonly source: InMemoryCardSource<T, M>,
		private readonly access: Access
	) {}

	advance = async (n: number) => {
		if (!isFinite(n) || n < 0 || Math.round(n) !== n)
			throw new Error(
				`Invalid value to advance by was provided; got ${n}`
			)

		for (let i = 0; i < n; i++) {
			if (!(await this.next())) {
				return i
			}
		}

		return n
	}

	left = async () => {
		const lastLoadedVersion = this.data.lastLoadedVersion ?? -Infinity
		return [
			0, // add these, so that if entries are empty list, nothing happens
			0,
			...this.access.entries.map((e) =>
				e.version > lastLoadedVersion ? 1 : 0
			),
		].reduce((a, b) => a + b)
	}
	clone = () => {
		return new InMemoryCardSourceCursor<T, M>(
			{ ...this.data },
			this.source,
			this.access
		) as this
	}

	refresh = async (): Promise<void> => {
		if (this.data.currentId === null) return
		if (
			!this.access.entries.find((e) => e.data.id === this.data.currentId)
		) {
			this.data.currentId = null
		}
	}

	get currentId(): string | null {
		return this.data.currentId
	}

	next = async (): Promise<boolean> => {
		const lastLoadedVersion = this.data.lastLoadedVersion
		if (lastLoadedVersion !== null) {
			const nextEntry = this.access.entries.find(
				(e) => e.version > lastLoadedVersion
			)
			if (!nextEntry) return false

			this.data.currentId = nextEntry.data.id
			this.data.lastLoadedVersion = nextEntry.version
			return true
		} else {
			if (!this.access.entries.length) {
				this.data.currentId = null
				return false
			}
			const entry = this.access.entries[0]
			this.data.currentId = entry.data.id
			this.data.lastLoadedVersion = entry.version

			return true
		}
	}
}

export class InMemoryCardSource<T extends { readonly id: string }, M = void>
	implements CardSource<T>, MutableCardSource<T>, MetadataCardSource<T, M>
{
	private versionCounter: number = -(2 ** 31)
	private entries: Entry<T>[]
	private metadata: M | null = null

	constructor(entries: T[]) {
		this.entries = entries.map((v) => ({
			data: v,
			version: this.versionCounter++,
		}))
	}

	clear = async () => {
		this.versionCounter = -(2 ** 31)
		this.entries = []
		this.metadata = null
	}

	private makeAccess = (): Access => {
		const self = this

		return {
			get entries() {
				return self.entries
			},
		}
	}

	append = async (data: T): Promise<void> => {
		this.entries.push({
			data,
			version: this.versionCounter++,
		})
	}

	delete = async (id: string): Promise<void> => {
		this.entries = this.entries.filter((e) => e.data.id !== id)
	}

	serializeCursor = (cursor: CardSourceCursor) => {
		if (
			!(cursor instanceof InMemoryCardSourceCursor) ||
			cursor.source !== this
		) {
			throw new Error(
				`Invalid cursor provided. It belongs to other store.`
			)
		}

		return {
			version: 0,
			data: cursor.data,
		}
	}

	deserializeCursor = (data: any): CardSourceCursor => {
		const { version } = data
		if (version !== 0) throw new Error(`Invalid version`)
		return new InMemoryCardSourceCursor(data.data, this, this.makeAccess())
	}

	getCard = async (cardId: string): Promise<T | null> => {
		return this.entries.find((e) => e.data.id === cardId)?.data ?? null
	}

	newCursor = (): CardSourceCursor => {
		return new InMemoryCardSourceCursor<T, M>(
			{
				lastLoadedVersion: null,
				currentId: null,
			},
			this,
			this.makeAccess()
		)
	}

	getMetadata = async (): Promise<M | null> => {
		return this.metadata
	}
	setMetadata = async (metadata: M): Promise<void> => {
		this.metadata = metadata
	}
}
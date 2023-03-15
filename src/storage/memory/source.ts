import { AppendDeleteCardSource, CardSource, CardSourceCursor } from "../source"

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

class InMemoryCardSourceCursor<T extends { readonly id: string }>
	implements CardSourceCursor
{
	constructor(
		public data: InMemoryCursorData,
		public readonly source: InMemoryCardSource<T>,
		private readonly access: Access
	) {}
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

export class InMemoryCardSource<T extends { readonly id: string }>
	implements CardSource<T>, AppendDeleteCardSource<T>
{
	private versionCounter: number = -(2 ** 31)
	private entries: Entry<T>[]

	constructor(entries: T[]) {
		this.entries = entries.map((v) => ({
			data: v,
			version: this.versionCounter++,
		}))
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
		return new InMemoryCardSourceCursor(
			{
				lastLoadedVersion: null,
				currentId: null,
			},
			this,
			this.makeAccess()
		)
	}
}

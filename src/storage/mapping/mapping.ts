import { CardSource } from "../source"

/**
 * CardSource, which is capable of translating cards of some type to cards of some other type.
 * That being said, most of the times, such translation should be done only at UI/display level.
 */
export class MappingCardSource<T, E> implements CardSource<E> {
	constructor(
		private readonly wrapped: CardSource<T>,
		private readonly mapper: (card: T) => Promise<E>
	) {}
	serializeCursor = this.wrapped.serializeCursor
	deserializeCursor = this.wrapped.deserializeCursor
	newCursor = this.wrapped.newCursor

	getCard = async (rawCardId: string): Promise<E | null> => {
		const inner = await this.wrapped.getCard(rawCardId)
		if (inner === null) return null

		return await this.mapper(inner)
	}
}

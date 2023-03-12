import { CardId } from "./storage"

export interface CardSource<T> {
	getCard: (cardId: CardId) => Promise<T | null>
	getCardNext: (lastCardId: CardId | null) => Promise<CardId | null>
}

export class InMemoryCardSource<T extends { id: string }>
	implements CardSource<T>
{
	constructor(private readonly cards: T[]) {}

	getCard = async (cardId: string): Promise<T | null> => {
		return this.cards.find((c) => c.id === cardId) ?? null
	}

	getCardNext = async (lastCardId: string | null): Promise<string | null> => {
		if (lastCardId === null) return this.cards[0]?.id ?? null
		const i = this.cards.findIndex((c) => c.id === lastCardId)
		if (i + 1 >= this.cards.length) return null
		return this.cards[i + 1].id
	}
}

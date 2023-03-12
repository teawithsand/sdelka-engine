export interface GroupedQueueElementProps {
	readonly id: string
	readonly group: string
	readonly priority: number
}

export type GroupedQueueElementPropsExtractor<T> = (
	element: T
) => GroupedQueueElementProps

export type GroupedQueueRangeLike = (
	| {
			fromIncl?: number
			fromExcl?: undefined
	  }
	| {
			fromExcl?: undefined
			fromIncl?: number
	  }
) &
	(
		| {
				toIncl?: number
				toExcl?: undefined
		  }
		| {
				toIncl?: undefined
				toExcl?: number
		  }
	)

/**
 * Priority queue, which is also capable of working like set and array.
 *
 * It first pops element, which have HIGHEST priority value.
 *
 * Elements are divided in groups. Each group can be thought of as internal priority queue,
 * which can be peeked separately.
 */
export interface GroupedQueue<T> {
	readonly extractor: GroupedQueueElementPropsExtractor<T>

	add: (element: T) => Promise<void>
	peekFront: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>
	popFront: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>

	peekBack: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>
	popBack: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>

	/**
	 * Returns amount of elements in specified groups, in specified priority range
	 */
	length: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<number>
	clear: (groups: string[]) => Promise<void>

	hasId: (id: string) => Promise<boolean>
	getId: (id: string) => Promise<T | null>
	deleteId: (id: string) => Promise<void>

	/**
	 * RESERVED FOR DEBUGGING USAGE!!!
	 * DO NOT USE IN PRODUCTION CODE!!!
	 */
	toArray: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T[]>
}

import { IDBComparable } from "../pubutil"

export interface GroupedQueueElementProps {
	readonly id: string
	readonly group: string
	readonly priority: IDBComparable
}

export type GroupedQueueElementPropsExtractor<T> = (
	element: T
) => GroupedQueueElementProps

export type GroupedQueueRangeLike = (
	| {
			fromIncl?: IDBComparable
			fromExcl?: undefined
	  }
	| {
			fromIncl?: undefined
			fromExcl?: IDBComparable
	  }
) &
	(
		| {
				toIncl?: IDBComparable
				toExcl?: undefined
		  }
		| {
				toIncl?: undefined
				toExcl?: IDBComparable
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
	/**
	 * Peeks element with highest priority.
	 */
	peekFront: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>
	/**
	 * Pops element with highest priority.
	 */
	popFront: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>

	/**
	 * Peeks element with lowest priority.
	 */
	peekBack: (
		groups: string[],
		priorityRange?: GroupedQueueRangeLike
	) => Promise<T | null>
	/**
	 * Pops element with lowest priority.
	 */
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

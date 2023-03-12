export interface GroupedQueueElementProps {
	readonly id: string
	readonly group: string
	readonly priority: number
}

export type GroupedQueueElementPropsExtractor<T> = (element: T) => GroupedQueueElementProps

export type GroupedQueueRange = {
	fromIncl?: number
	toIncl?: number
}


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

	push: (element: T) => Promise<void>
	peek: (groups: string[], priorityRange?: GroupedQueueRange) => Promise<T | null>
	pop: (groups: string[], priorityRange?: GroupedQueueRange) => Promise<T | null>

	/**
	 * Returns amount of elements in specified groups, in specified priority range
	 */
	length: (groups: string[], priorityRange?: GroupedQueueRange) => Promise<number>
	clear: (groups: string[]) => Promise<void>
	
	hasId: (id: string) => Promise<boolean>
	getId: (id: string) => Promise<T | null>
	deleteId: (id: string) => Promise<void>

	/**
	 * RESERVED FOR DEBUGGING USAGE!!!
	 * DO NOT USE IN PRODUCTION CODE!!!
	 */
	toArray: (groups: string[]) => Promise<T[]>
}

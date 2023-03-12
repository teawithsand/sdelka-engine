import { GroupedQueueRangeLike } from "../storage"

export const dispatchRange = (range: GroupedQueueRangeLike) => ({
	from: range.fromIncl ?? range.fromExcl,
	fromIncl: range.fromIncl !== undefined,
	to: range.toIncl ?? range.toExcl,
	toIncl: range.toIncl !== undefined,
})

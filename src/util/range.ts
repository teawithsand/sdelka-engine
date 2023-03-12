import { GroupedQueueRangeLike } from "../storage"

const isIncl = (incl: number | undefined, excl: number | undefined) => {
	if (incl === undefined && excl === undefined) return undefined
	return incl !== undefined
}

const innerDispatchRange = (range: GroupedQueueRangeLike) => ({
	from: range.fromIncl ?? range.fromExcl,
	fromIncl: isIncl(range.fromIncl, range.fromExcl),
	to: range.toIncl ?? range.toExcl,
	toIncl: isIncl(range.toIncl, range.toExcl),
})

export const dispatchRange = (
	range: GroupedQueueRangeLike,
	fallback?: GroupedQueueRangeLike
) => {
	let base = innerDispatchRange(range)
	if (fallback) {
		const { from, fromIncl, to, toIncl } = innerDispatchRange(fallback)
		if (base.fromIncl === undefined) {
			base = {
				...base,
				from,
				fromIncl,
			}
		}

		if (base.toIncl === undefined) {
			base = {
				...base,
				to,
				toIncl,
			}
		}
	}
	return base
}

export const fallsInRange = (
	range: GroupedQueueRangeLike,
	value: number
): boolean => {
	const { from, to, fromIncl, toIncl } = dispatchRange(range)

	if (from !== undefined) {
		if (fromIncl) {
			if (value < from) return false
		} else {
			if (value <= from) return false
		}
	}
	if (to !== undefined) {
		if (toIncl) {
			if (value > to) return false
		} else {
			if (value >= to) return false
		}
	}

	return true
}

import { IDBComparable, idbComparator } from "../pubutil"
import { GroupedQueueRangeLike } from "../storage"

const isIncl = (
	incl: IDBComparable | undefined,
	excl: IDBComparable | undefined
) => {
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
	value: IDBComparable
): boolean => {
	const { from, to, fromIncl, toIncl } = dispatchRange(range)
	if (from !== undefined) {
		if (fromIncl) {
			if (idbComparator(value, from) < 0) return false
		} else {
			if (idbComparator(value, from) <= 0) return false
		}
	}
	if (to !== undefined) {
		if (toIncl) {
			if (idbComparator(value, to) > 0) return false
		} else {
			if (idbComparator(value, to) >= 0) return false
		}
	}

	return true
}

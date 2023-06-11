const isBrowser = typeof crypto !== "undefined"

export const generateUUID = () => {
	if (isBrowser) {
		return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(
			/[018]/g,
			(c: any) =>
				(
					c ^
					(crypto.getRandomValues(new Uint8Array(1))[0] &
						(15 >> (c / 4)))
				).toString(16)
		) as string
	} else {
		var d = new Date().getTime() //Timestamp
		var d2 =
			(typeof performance !== "undefined" &&
				performance.now &&
				performance.now() * 1000) ||
			0 //Time in microseconds since page-load or 0 if unsupported
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
			/[xy]/g,
			function (c) {
				var r = Math.random() * 16 //random number between 0 and 16
				if (d > 0) {
					//Use timestamp until depleted
					r = (d + r) % 16 | 0
					d = Math.floor(d / 16)
				} else {
					//Use microseconds since page-load if supported
					r = (d2 + r) % 16 | 0
					d2 = Math.floor(d2 / 16)
				}
				return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
			}
		)
	}
}

/**
 * Timestamp type, which under the hood is number.
 * It's always integer with ms precision.
 */
export type TimestampMs = number & { readonly s: unique symbol }

export const getNowTimestamp = (): TimestampMs => {
	return Math.round(new Date().getTime()) as TimestampMs
}

export const timestampToDate = (ts: TimestampMs): Date => {
	if (isFinite(ts) || ts < 0)
		throw new Error(`Invalid timestamp to format as date: ${ts}`)
	return new Date(Math.round(ts))
}

/**
 * Timestamp, which was yielded from non-backing performance clock rather than wall clock.
 */
export type PerformanceTimestampMs = number & { readonly s: unique symbol }
export const getNowPerformanceTimestamp = (): PerformanceTimestampMs =>
	window.performance.now() as PerformanceTimestampMs

/**
 * Allows you to use kotlin-like ?: throw or sth like that.
 *
 * Can be used like `const a = obj.x ?? throwExpression(new Error("no x"))`
 */
export const throwExpression = (e: any): never => {
	throw e
}

/**
 * Allows you to use kotlin-like ?: throw or sth like that.
 *
 * Can be used like `const a = obj.x ?? throwExpression(() => new Error("no x"))`
 */
export const throwExpressionLazy = (e: () => any): never => {
	throw e()
}

export const filterNotNull = <T>(arr: (T | null)[]): T[] => {
	return arr.filter((c) => c !== null) as T[]
}

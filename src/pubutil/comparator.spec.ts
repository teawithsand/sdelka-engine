import { idbComparator, MAX_IDB_KEY } from "./comparator"

describe("idbComparator", () => {
	it("works", () => {
		expect(idbComparator(1, 2)).toBeLessThan(0)
		expect(idbComparator(-Infinity, Infinity)).toBeLessThan(0)
		expect(idbComparator(Infinity, -Infinity)).toBeGreaterThan(0)

		expect(idbComparator(1, "a")).toBeLessThan(0)
		expect(idbComparator(1, "a")).toBeLessThan(0)

		expect(idbComparator(MAX_IDB_KEY, "a")).toBeGreaterThan(0)
		expect(idbComparator(MAX_IDB_KEY, new Date())).toBeGreaterThan(0)

        // TODO(teawithsand): more testing here
	})
})

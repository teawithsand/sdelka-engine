export interface Counter {
	getValue: () => Promise<number>
	setValue: (value: number) => Promise<void>
	reset: () => Promise<void>
	getAndIncrement: () => Promise<number>
}

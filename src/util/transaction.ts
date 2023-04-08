import { throwExpression } from "./stl"

/**
 * Helper for making in-memory transactions.
 */
export class InMemoryTransactionHelper<T> {
	private txStack: T[] = []

	runWithTransaction = async <R>(
		data: T,
		callback: (data: T) => Promise<R>,
		onCatch?: (e: any) => Promise<void>
	) => {
		this.enterTransaction(data)
		try {
			return await callback(data)
		} catch (e) {
			if (onCatch) await onCatch(e)
			throw e
		} finally {
			this.exitTransaction()
		}
	}

	runWithTransactionReuse = async <R>(
		callback: (data: T) => Promise<R>,
		onCatch?: (e: any) => Promise<void>
	) => {
		if (!this.isInTransaction) throw new Error("Not in transaction")
		try {
			return await callback(
				this.currentTransactionData ??
					throwExpression(new Error("Unreachable code"))
			)
		} catch (e) {
			if (onCatch) await onCatch(e)
			throw e
		}
	}

	/**
	 * Replaces current transaction data with new one.
	 * Throws if not in transaction.
	 */
	replaceTransactionData = (data: T) => {
		this.exitTransaction()
		this.enterTransaction(data)
	}

	enterTransaction = (data: T) => {
		this.txStack.push(data)
	}

	exitTransaction = () => {
		this.txStack.pop() ??
			throwExpression(new Error("No transaction to exit from"))
	}

	get isInTransaction() {
		return !!this.txStack.length
	}

	get currentTransactionData(): T | null {
		return this.txStack[this.txStack.length - 1] ?? null
	}
}

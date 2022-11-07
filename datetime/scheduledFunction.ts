import { ONE_DAY } from "./constants";

/**
 * Creates a scheduled call to the given function
 * 
 * A timeout fires internally once a day until the last
 * day and then fires the given callback when the time has finally
 * expired.
 *
 * Useful as the 'timeout' in node is only good for about 24 days.
 */
export const ScheduledFunction: AssetGenerator < {
	/** The number of milliseconds to execution of the callback */
	milliseconds: number,
	/** Function to execute */
	callback: () => void
}, {
	/**
	 * Reset the timeout to the function call, if already executed
	 * it will be called again
	 */
	reset: (milliseconds: number) => void
} > = (options) => {

	let targetTime = Date.now() + options.milliseconds;
	let timeout: NodeJS.Timeout | null = null;

	/** Calls the given callback function or repeats the internal timeout */
	const fireTimeout = () => {
		destroyTimeout();

		if (targetTime <= Date.now()) {
			options.callback();
		} else {
			updateTimeout();
		}
	}

	/** Updates the internal timeout an additionl day */
	const updateTimeout = () => {
		destroyTimeout();

		let interval = (targetTime - Date.now()) >= ONE_DAY ? ONE_DAY : targetTime - Date.now();

		timeout = setTimeout(() => {
			fireTimeout();
		}, interval);
	}

	/** Destroys the internal timeout */
	const destroyTimeout = () => {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
	}

	// Starts the timeout
	fireTimeout();

	// Asset
	return ({
		reset: (milliseconds) => {
			targetTime = Date.now() + milliseconds;
			fireTimeout();
		},
		close: destroyTimeout
	});
}
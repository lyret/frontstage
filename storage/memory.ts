/**
 * Simple asset for storing values in a dictionary format in memory
 */
export const InMemoryCollection = < Key extends String,
	Value > (): Asset < {
		get: (key: Key) => Value | undefined
		set: (key: Key, value: Value) => void
		remove: (key: Key) => void
		values: () => IterableIterator<Value>
		exists: (key: Key) => boolean
	} > => {
		const _map = new Map < Key,
			Value > ();

		// Asset
		return ({
			get: (key: Key) => {
				return _map.get(key)
			},
			set: (key: Key, value: Value) => {
				_map.set(key, value);
			},
			remove: (key: Key) => {
				_map.delete(key)
			},
			exists: (key: Key) => {
				return _map.has(key);
			},
			values: () => {
				return _map.values();
			},
			close: () => {
				_map.clear();
			}
		})
	}
import { BroadcastChannel } from "broadcast-channel";

type AnyMessageType<K, V> =
  | {
      event: "delete";
      key: K;
    }
  | {
      event: "set";
      key: K;
      value: V;
    }
  | {
      event: "clear";
    };

// TODO: document file
export class SharedMemoryMap<K, V> implements Map<K, V> {
  private _map: Map<K, V>;
  private _channel: BroadcastChannel<AnyMessageType<K, V>>;

  constructor(topic: string) {
    // Append the current build version number to the topic to avoid version conflicts
    topic = `servermanager.maps.${topic.toLowerCase().trim()}.${BUILD_NUMBER}`;

    // Create internal structures
    this._map = new Map();
    this._channel = new BroadcastChannel(topic);

    // Listen to incoming events
    this._channel.addEventListener("message", (message) => {
      switch (message.event) {
        case "clear":
          this._map.clear();
          break;
        case "delete":
          this._map.delete(message.key);
          break;
        case "set":
          this._map.set(message.key, message.value);
          break;
      }
    });
  }

  async close(): Promise<void> {
    this._channel.close();
  }
  clear(): void {
    this._channel.postMessage({
      event: "clear",
    });
    return this._map.clear();
  }
  delete(key: K): boolean {
    this._channel.postMessage({
      event: "delete",
      key,
    });
    return this._map.delete(key);
  }
  set(key: K, value: V): this {
    this._channel.postMessage({
      event: "set",
      key,
      value,
    });
    this._map.set(key, value);
    return this;
  }
  get(key: K): V | undefined {
    return this._map.get(key);
  }
  has(key: K): boolean {
    return this._map.has(key);
  }
  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: any
  ): void {
    return this._map.forEach(callbackfn, thisArg);
  }
  entries(): IterableIterator<[K, V]> {
    return this._map.entries();
  }
  keys(): IterableIterator<K> {
    return this._map.keys();
  }
  values(): IterableIterator<V> {
    return this._map.values();
  }
  get size(): number {
    return this._map.size;
  }
  get [Symbol.toStringTag](): string {
    return this._map[Symbol.toStringTag];
  }
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this._map[Symbol.iterator]();
  }
}

import { EventEmitter } from "node:events";
import { BroadcastChannel } from "broadcast-channel";

/** The local channel class is to make sure that messages are receivable in the same process */
class LocalChannel extends EventEmitter {}

/** In-memory collection of opened broadcast channels */
const openBroadcastChannels = new Map<string, BroadcastChannel>();

/** In-memory local channels */
const openLocalChannels = new Map<string, LocalChannel>();

/** Extendable type for defining message handlers */
export type MessageHandler<T> = (data: T) => void | Promise<void>;

/** Uses a broadcast channel to listen to incoming messages of the given type */
export async function listenToMessages<T>(
  topic: string,
  handler: MessageHandler<T>
) {
  // Get opened channels
  const [broadcastChannel, localChannel] = getChannels<T>(topic);

  // Add the handler as an event listener on the broadcast channel
  broadcastChannel.addEventListener("message", handler);

  // Add it to the local listener
  localChannel.on("message", handler);
}

/**
 * Opens a message bus to a process in PM2
 * and sends a message with the given topic and data.
 * returns true if successful
 * @param waitForResponse waits a response with status 200 before resolving
 */
export async function sendMessage<T>(topic: string, message: T) {
  // Get opened channels
  const [broadcastChannel, localChannel] = getChannels<T>(topic);

  // Post the message on the broadcast channel
  await broadcastChannel.postMessage(message);
  // Post the message on the local channel
  localChannel.emit("message", message);
}

/** Closes all open broadcast channels */
export async function disconnect() {
  for (const channel of openBroadcastChannels.values()) {
    await channel.close();
  }
  openBroadcastChannels.clear();

  for (const channel of openLocalChannels.values()) {
    channel.removeAllListeners();
  }
  openLocalChannels.clear();
}

/**
 * Gets an open messages channel for the given topic
 * Returns both a broadcast channel for IPC and a local
 * emitter for sending messages inside the same process.
 * and makes sure they are cached and closable
 */
function getChannels<T>(topic: string): [BroadcastChannel<T>, LocalChannel] {
  // Append the current build version number to the topic to avoid version conflicts
  topic = `servermanager.${topic.toLowerCase().trim()}.${BUILD_NUMBER}`;

  // Get the broadcast channel for the given topic, use the cached version if it exists
  const broadcastChannel =
    openBroadcastChannels.get(topic) || new BroadcastChannel<T>(topic);

  // Get the local channel for the given topic, use the cached version if it exists
  const localChannel = openLocalChannels.get(topic) || new LocalChannel();

  // Cache the opened channels
  if (!openBroadcastChannels.has(topic)) {
    openBroadcastChannels.set(topic, broadcastChannel);
  }
  if (!openLocalChannels.has(topic)) {
    openLocalChannels.set(topic, localChannel);
  }

  // Return the channels
  return [broadcastChannel as BroadcastChannel<T>, localChannel];
}

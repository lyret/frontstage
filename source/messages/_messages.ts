import { BroadcastChannel } from "broadcast-channel";

/** In-memory collection of opened broadcast channels */
const openChannels = new Map<string, BroadcastChannel>();

/** Extendable type for defining message handlers */
export type MessageHandler<T> = (data: T) => void | Promise<void>;

/** Uses a broadcast channel to listen to incoming messages of the given type */
export async function listenToMessages<T>(
  topic: string,
  handler: MessageHandler<T>
) {
  // Get an opened channel
  const broadcastChannel = getChannel<T>(topic);

  // Add the handler as an event listener
  broadcastChannel.addEventListener("message", handler);
}

/**
 * Opens a message bus to a process in PM2
 * and sends a message with the given topic and data.
 * returns true if successful
 * @param waitForResponse waits a response with status 200 before resolving
 */
export async function sendMessage<T>(topic: string, message: T) {
  // Get an opened channel
  const broadcastChannel = getChannel<T>(topic);

  // Post the message
  await broadcastChannel.postMessage(message);
}

/** Utility function that gets an open messages channel for the given topic */
function getChannel<T>(topic: string): BroadcastChannel<T> {
  // Append the current build version number to the topic to avoid version conflicts
  topic = `servermanager.${topic.toLowerCase().trim()}.${BUILD_NUMBER}`;

  // Get the broadcast channel for the given topic, use the cached version if it exists
  const broadcastChannel =
    openChannels.get(topic) || new BroadcastChannel<T>(topic);

  // Cache the opened channel
  if (!openChannels.has(topic)) {
    openChannels.set(topic, broadcastChannel);
  }

  // Return the channel
  return broadcastChannel as BroadcastChannel<T>;
}

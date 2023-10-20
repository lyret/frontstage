import { sendMessage, listenToMessages, MessageHandler } from "./_messages";

type MessageType = Omit<Messages.ScheduledOperation, "performed">;

/**
 * Sends an operation to the internal scheduler process running in PM2
 * which will result in it being executed at the specific timestamp.
 */
export async function scheduleOperation(operation: MessageType) {
  return sendMessage("scheduled.operation", operation);
}

/**
 * Listen to incoming scheduled operations
 */
export async function onScheduleOperation(
  handler: MessageHandler<MessageType>
) {
  return listenToMessages("scheduled.operation", handler);
}

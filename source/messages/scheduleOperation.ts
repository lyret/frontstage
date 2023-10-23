import { sendMessage, listenToMessages, MessageHandler } from "./_messages";

type MessageType<
  T extends Messages.ScheduledOperation = Messages.ScheduledOperation
> = Omit<T, "performed">;

/**
 * Sends an operation to the internal scheduler process running in PM2
 * which will result in it being executed at the specific timestamp.
 */
export async function scheduleOperation<
  T extends Messages.ScheduledOperation = Messages.ScheduledOperation
>(operation: MessageType<T>) {
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

import { Models } from "../database";
import { sendMessage } from "./_messages";

/**
 * Updates the internal state on the given index and sends a message
 * that the state has changed to all listening internal processes
 */
export async function updateState<
  Index extends keyof States.States,
  State extends States.States[Index]
>(index: Index, state: State): Promise<void> {
  // Update the state in the database
  const db = await Models.StateObjects();
  await db.upsert({ index, state });

  // Message all listening processes
  await sendMessage<State>(`state.${index}`, state);
}

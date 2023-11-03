import { Models } from "../database";
import { sendMessage, listenToMessages } from "./_messages";

/**
 * Updates the stored configuration on the given index and sends a message
 * that the state has changed to all listening internal processes
 */
export async function updateConfiguration<
  Index extends keyof State.StoredConfigurations,
  State extends State.StoredConfigurations[Index]
>(index: Index, state: State): Promise<void> {
  // Update the state in the database
  const db = await Models.Configurations();
  await db.upsert({ index, state });

  // Message all listening processes
  await sendMessage<State>(`state.${index}`, state);
}

/**
 * Listens to any changes made on the configuration at
 * the given index and calls the given handler
 * on any updates
 */
export async function onConfigurationChange<
  Index extends keyof State.StoredConfigurations,
  State extends State.StoredConfigurations[Index]
>(index: Index, onState: (state: State) => any): Promise<void> {
  // Get the current state if it exists
  const db = await Models.Configurations();
  const model = await db.findOne({ where: { index } });

  if (model) {
    onState(model.toJSON().state as State);
  }

  listenToMessages<State>(`state.${index}`, (newState) => {
    if (newState) {
      onState(newState);
    }
  });
}

/**
 * Retrieves the current configuration from the database if its available
 */
export async function getConfiguration<
  Index extends keyof State.StoredConfigurations,
  State extends State.StoredConfigurations[Index]
>(index: Index): Promise<State | undefined> {
  // Get the current state if it exists
  const db = await Models.Configurations();
  const model = await db.findOne({ where: { index } });

  if (model) {
    return model.toJSON().state as State;
  }
  return undefined;
}

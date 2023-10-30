import * as Path from "node:path";
import * as FSE from "fs-extra";
import {
  Sequelize,
  Model,
  ModelAttributes,
  ModelOptions,
  ModelCtor,
  Attributes,
} from "sequelize";
import { createLogger } from "../messages";

/** The open database connection if it exists */
let openConnection: Sequelize | null = null;

/** In-memory collection of models that have been defined */
const createdModels = new Map<string, ModelCtor<any>>();

/** Logger */
const logger = createLogger("Database");

/** Utility function that returns the open database connection or creates it */
export async function connect(): Promise<Sequelize> {
  // Use the in-memory version if it exists
  if (openConnection) {
    return openConnection;
  }

  // Determine the path to the database, append the current build number
  // and make a copy of the old database version if the number has
  // changed since last run
  const dbPath = Path.resolve(
    DATABASE_DIRECTORY,
    `database-${BUILD_NUMBER}.sqlite`
  );

  // If the database does not exists
  if (!FSE.existsSync(dbPath)) {
    // check if any other database file exists in the database directory
    // cache it in the cache directory
    // and copy it so it becomes the new active database, prevents data
    // being destroyed from bad code and when definitions change
    const existingDatabase = FSE.readdirSync(DATABASE_DIRECTORY).filter(
      (file) => file.includes(".sqlite")
    )[0];

    if (existingDatabase) {
      const oldDbPath = Path.resolve(DATABASE_DIRECTORY, existingDatabase);
      const cachedDBPath = Path.resolve(CACHE_DIRECTORY, existingDatabase);
      await FSE.copy(oldDbPath, cachedDBPath);
      await FSE.move(oldDbPath, dbPath);
    }
  }

  // Connect to the database of the given name
  const connection = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
    logging: (sql) => logger.trace(sql),
  });
  try {
    await connection.authenticate();
    logger.info(`Connected`);
  } catch (err) {
    logger.error(`Unable to connect`, err);
  }

  // Cache the connection and return it
  openConnection = connection;
  return connection;
}

/** Closes the database connection */
export async function disconnect() {
  if (openConnection) {
    await openConnection.connectionManager.close();
    openConnection = null;
  }
  createdModels.clear();
}

/**
 * Takes a dictionary of model definitions and returns a new
 * object with the same keys but with async methods for retrieving
 * the created model with the given definition.
 * This makes sure that the model is always asynchronously created
 * before being accessed (lazely)
 */
export function defineModels<
  Definitions extends { [k: string]: ModelDefinition<any> }
>(
  definitions: Definitions
): {
  [K in keyof Definitions]: () => Promise<
    ModelCtorFromSpecification<Definitions[K]>
  >;
} {
  return <any>Object.fromEntries(
    Object.entries(definitions).map(([key, { attributes, options }]) => {
      return [
        key,
        async () => {
          // Return the model if its already created
          if (createdModels.has(key)) {
            return createdModels.get(key);
          }
          // Otherwise create it, save it and return it
          const connection = await connect();
          const model = connection.define(key, attributes, options);
          await model.sync({ alter: true });
          createdModels.set(key, model);
          return model;
        },
      ];
    })
  );
}

/** Creates a model definition object from the given attributes and options */
export function defineModel<T extends object>(
  attributes: ModelAttributes<Model<T, T>, Attributes<Model<T>>>,
  options: ModelOptions<Model<T>>
): ModelDefinition<T> {
  return { attributes, options };
}

/** Whats needed to define (i.e. create) a new model */
type ModelDefinition<T extends object> = {
  attributes: ModelAttributes<Model<T>>;
  options: ModelOptions<Model<T>>;
};

/** Infers the type used to define a given model and creates whats returned
 * after its defined and created at runtime.
 */
type ModelCtorFromSpecification<Def> = Def extends ModelDefinition<infer T>
  ? ModelCtor<Model<T>>
  : never;

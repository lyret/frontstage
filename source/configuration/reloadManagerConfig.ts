import * as FS from "node:fs";
import * as FSP from "node:fs/promises";
import * as Path from "node:path";
import * as Yaml from "yaml";
import { z } from "zod";
import { updateState } from "../messages";

/**
 * Reloads the manager configuration from the configuration file
 * and updates its current state in the database
 * Also writes the complete configuration file to
 * the configuration file path so thats that the file reflects
 * the current state
 */
export async function reloadManagerConfig(): Promise<void> {
  let configurationObject: Partial<Configuration.Manager> = {};
  let configurationFileText: string = "";

  // Read the current configuration file
  if (FS.existsSync(MANAGER_CONFIG_FILE)) {
    configurationFileText = FS.readFileSync(MANAGER_CONFIG_FILE, "utf-8");
  }

  // Parse the contents from the yaml text
  if (configurationFileText) {
    configurationObject = Yaml.parse(configurationFileText);

    // Make sure that the configuration file is an object
    if (
      !(
        typeof configurationObject === "object" &&
        !Array.isArray(configurationObject) &&
        configurationObject !== null
      )
    ) {
      configurationObject = {};
    }
  }

  // Validate the configuration
  const validationResults =
    managerConfigurationSchema.safeParse(configurationObject);

  // Output any problems with the configuration and raise an error
  if (!validationResults.success) {
    console.error(`There are errors in the manager configuration file:`);
    console.error(`Fix the following errors:\n`);

    // Print each issue, transform the path to make it readable
    const issues = validationResults.error.issues;
    for (const issue of issues) {
      const path = issue.path
        .map((subpath) => {
          if (!Number.isNaN(Number(subpath))) {
            return "row " + subpath;
          }
          return subpath;
        })
        .join(", ");
      console.error(`  ${path}: ${issue.message}`);
    }
    console.error("");

    // Raise the problem
    throw new Error("The manager configuration file is invalid");
  }

  // NOTE: It would be nice to preserve/add comments here
  // Write the new validated configuration to file
  await FSP.writeFile(
    MANAGER_CONFIG_FILE,
    Yaml.stringify(validationResults.data),
    {
      encoding: "utf8",
    }
  );

  // Update the configuration state in the database and message running internal processes
  await updateState(
    "manager_configuration",
    validationResults.data as Configuration.Manager
  );
}

/** Validation schema for the manager configuration file */
const managerConfigurationSchema = z
  .object({
    logging: z
      .object({
        level: z.number().default(60),
      })
      .strict()
      .default({}),
    web_traffic: z
      .object({
        use_http: z.boolean().default(false),
        http_port: z.number().default(80),
        http_host: z.string().default("127.0.0.1"),
        use_https: z.boolean().default(false),
        https_port: z.number().default(443),
        https_host: z.string().default("127.0.0.1"),
        use_forwarded_host: z.boolean().default(false),
      })
      .strict()
      .default({}),
    certificates: z
      .object({
        self_signed_certificates: z
          .object({
            country: z.string().default("Milkyway Galaxy"),
            state: z.string().default("Ursa Minor Beta"),
            locality: z.string().default("ZZ9 Plural Z Alpha"),
            organization: z.string().default("Megadodo Publications"),
          })
          .strict()
          .nullish()
          .default(null),
        lets_encrypt: z
          .object({
            use_production_server: z.boolean().default(false),
            contact_email: z.string().nullish(),
          })
          .strict()
          .nullish()
          .default(null),
      })
      .strict()
      .default({}),
    dns_records: z
      .object({
        digital_ocean: z
          .object({
            token: z.string().nullish(),
          })
          .strict()
          .nullable()
          .default(null),
      })
      .strict()
      .default({}),
    daemons: z
      .object({
        root_directory: z
          .string()
          .default(SOURCE_DIRECTORY)
          .transform((path) => Path.resolve(SOURCE_DIRECTORY, path)),
      })
      .strict()
      .default({}),
  })
  .strict()
  .default({});

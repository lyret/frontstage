import * as FS from "node:fs";
import * as Yaml from "yaml";
import { z } from "zod";
import { updateConfiguration } from "../messages";

/**
 * Reloads the applications configuration from the configuration file
 * and updates it in the database
 */
export async function reloadApplicationsConfig(): Promise<void> {
  // Read the current application configuration file
  if (!FS.existsSync(APPS_CONFIG_FILE)) {
    throw new Error(
      "The app configuration file does not exist at " + APPS_CONFIG_FILE
    );
  }
  const contents = FS.readFileSync(APPS_CONFIG_FILE, "utf-8");

  // Parse and validate the configuration
  const validationResults = applicationConfigurationSchema.safeParse(contents);

  // Output any problems with the configuration and raise an error
  if (!validationResults.success) {
    console.error(`There are errors in the application configuration file:`);
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
    throw new Error("The application configuration file is invalid");
  }

  // Update the configuration state in the database and running internal processes
  await updateConfiguration(
    "application_configuration",
    validationResults.data as Array<Configuration.Application>
  );
}

/** Extended validation methods */
const ze = {
  /** Matches a yaml string of the given schema */
  yaml: <T extends z.ZodTypeAny | z.TransformEffect<any>>(schema: T) =>
    z
      .string()
      .transform<z.ZodTypeAny>((val, ctx) => {
        try {
          return Yaml.parse(val);
        } catch (err: any) {
          ctx.addIssue({
            path: ["yaml"],
            message: `${err.message}`,
            code: z.ZodIssueCode.custom,
            params:
              err.linePos && err.linePos.length
                ? {
                    line: err.linePos[0].line,
                    col: err.linePos[0].col,
                  }
                : undefined,
          });
          return z.NEVER;
        }
      })
      .pipe(schema as any),
  /** Matches a hostname or a wildcard hostname */
  hostname: () =>
    z.string().refine((domain) => {
      // Allow wildcard domains
      domain = domain.replace(/^\*\.*/, "");

      // Split by dot and check each part
      let parts = domain.split(".");
      for (let part of parts) {
        if (!/^([a-zA-Z0-9åäö-]+)$/.test(part)) {
          return false;
        }
      }

      return true;
    }, "Must be a valid hostname"),
};

/**Validation schema for configuring an application process */
const process = z
  .object({
    script: z.string(),
    cwd: z.string().nullable().optional(),
    intepreter: z.string().nullable().optional(),
    args: z.string().nullable().optional(),
    env: z
      .record(z.union([z.string(), z.number()]))
      .nullable()
      .optional(),
  })
  .strict()
  .transform((process) => process as Configuration.Application["process"]);

/* Validation schema for a individual application configuration */
const applicationSchema = z
  .object({
    label: z.string().regex(/[a-z\/]*/),
    process: process.nullable().optional(),
    certificates: z
      .literal("lets-encrypt")
      .or(z.literal("self-signed"))
      .or(z.literal("default"))
      .default("default"),
    redirect: z.string().nullable().optional(),
    serve: z.string().nullable().optional(),
    port: z.number().int().nullable().optional(),
    hostname: ze.hostname().optional(),
    hostnames: z.array(ze.hostname()).optional(),
  })
  .superRefine((app, ctx) => {
    // Validate that not both 'hostname' and 'hostnames' are given
    // as options at the same time
    if (app.hostnames && app.hostnames.length) {
      if (app.hostname) {
        ctx.addIssue({
          path: [],
          code: z.ZodIssueCode.custom,
          message:
            "An application can't be configured with both the 'hostname' and 'hostnames' options, remove one",
        });
      }
    }
    // Validate that only a single possible way to handle http traffic
    // is configured
    let nrOfAddedConfigurations = 0;
    if (app.port !== undefined && app.port !== null) {
      nrOfAddedConfigurations++;
    }
    if (app.redirect !== undefined && app.redirect !== null) {
      nrOfAddedConfigurations++;
    }
    if (app.serve !== undefined && app.serve !== null) {
      nrOfAddedConfigurations++;
    }
    if (nrOfAddedConfigurations > 1) {
      ctx.addIssue({
        path: [app.label],
        code: z.ZodIssueCode.custom,
        message:
          "An application can be configured with either one of the 'serve', 'port' or 'redirect' options",
      });
    }
  })
  .transform((app) => app as Configuration.Application);

/** Validation schema for the application configuration file */
const applicationConfigurationSchema = ze
  .yaml(
    z
      // Pass z.any here to first get the array, this makes
      // error handling more detailed as the label for the
      // application that creates the issue can be known
      .array(z.any())
      .nullable()
      // Make sure that the array contains valid application
      // configurations, add the apps label to any issue found and
      // abort
      .transform((dataArray, ctx) => {
        // Null is accepted
        if (!dataArray) {
          dataArray = [];
        }
        return dataArray.map((data, arrayIndex) => {
          const res = applicationSchema.safeParse(data);
          if (!res.success) {
            for (const issue of res.error.issues) {
              ctx.addIssue({
                fatal: true,
                code: z.ZodIssueCode.custom,
                message: issue.message,
                path: [
                  arrayIndex,
                  data?.label ? data.label : "?",
                  ...ctx.path,
                  ...issue.path,
                ],
              });
            }
            return z.NEVER;
          }
          return res.data;
        });
      })
      // Handle overall issues with the application configuration
      // Target each app in the configuration, and search for the conflicting
      // values previously in the list of applications
      .superRefine((applications, ctx) => {
        for (
          let firstIndex = 0;
          firstIndex < applications.length;
          firstIndex++
        ) {
          for (let secondIndex = 0; secondIndex < firstIndex; secondIndex++) {
            const firstApp = applications[secondIndex];
            const secondApp = applications[firstIndex];

            // Find duplicated labels
            if (firstApp.label == secondApp.label) {
              ctx.addIssue({
                path: [firstIndex, firstApp.label],
                code: z.ZodIssueCode.custom,
                message: `The label ${firstApp.label} is also used for application at index ${secondIndex}`,
                params: {
                  label: firstApp.label,
                },
              });
              ctx.addIssue({
                path: [secondIndex, secondApp.label],
                code: z.ZodIssueCode.custom,
                message: `The label ${secondApp.label} is already used for application at index ${firstIndex}`,
                params: {
                  label: secondApp.label,
                },
              });
            }

            // Find duplicated ports
            if (firstApp.port && firstApp.port == secondApp.port) {
              ctx.addIssue({
                path: [firstIndex, firstApp.label],
                code: z.ZodIssueCode.custom,
                message: `The port ${firstApp.port} is also used for the application "${secondApp.label}" at index ${secondIndex}`,
                params: {
                  label: firstApp.label,
                },
              });
              ctx.addIssue({
                path: [secondIndex, secondApp.label],
                code: z.ZodIssueCode.custom,
                message: `The port ${secondApp.port} is already used for application "${firstApp.label}" at index ${firstIndex}`,
                params: {
                  label: secondApp.label,
                },
              });
            }
          }
        }

        // This type is never used, but needs to be returned
        return z.NEVER;
      })
  )
  .transform((config) => config as Array<Configuration.Application>);

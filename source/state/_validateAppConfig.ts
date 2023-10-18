import * as Yaml from "yaml";
import { z } from "zod";

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
    z
      .string()
      .regex(
        /^(?:([a-zA-Z0-9-]+|\*)\.)?([a-zA-Z0-9-]{1,61})\.([a-zA-Z0-9]{2,7})$/,
        "Must be a valid hostname"
      ),
  /** Matches an array of only unique values  */
  uniqueArray: <T extends z.ZodTypeAny, Array extends z.ZodArray<T, any>>(
    array: Array
  ) => array,
};

// TODO: Use ZOD instead

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
  .strict();

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
    hostnames: ze.uniqueArray(z.array(ze.hostname())).optional(),
  })
  .superRefine((app, ctx) => {
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
  });
// .and(
//   z.union([
//     /* Application with redirection */
//     z.object({}),
//     /* Application with static server */
//     z.object({}),
//     /* Application with a targeted port */
//     z.object({}),
//   ])
// )
// .and(
//   z.union([
//     /* Application with single hostname */
//     z.object({}),
//     /* Application with several hostnames */
//     z.object({}),
//   ])
// );

type Application = z.infer<typeof applicationSchema>;

/** Validation schema for the application configuration file */
const applicationConfiguration = ze.yaml(
  z
    .array(z.any())
    .nonempty()
    .transform((dataArray, ctx) => {
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
    .superRefine((applications, ctx) => {
      // Target each app in the configuration, and search for the conflicting
      // values previously in the list of applications
      for (let firstIndex = 0; firstIndex < applications.length; firstIndex++) {
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
);

/**
 * Validates the given text contents for a valid YAML configuration
 * of applications and returns it as a JSON object
 */
export function validateAppConfig(
  contents: string
): Array<Configuration.Application> | void {
  // Parse and validate the configuration
  const results = applicationConfiguration.safeParse(contents);

  // Output any problems with the configuration and raise an error
  if (!results.success) {
    // Output
    console.error(`  There are errors in the configuration file:`);
    console.error(`  Fix the following errors:\n`);
    const issues = results.error.issues;

    for (const issue of issues) {
      console.error(`  ${issue.path.join(", ")}: ${issue.message}`);
    }
    console.error("");

    // Raise the problem
    throw new Error("The app configuration file is invalid");
  }

  return results.data as any;
}

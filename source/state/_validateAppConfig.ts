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
            path: [],
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
  uniqueArray: <T extends z.ZodTypeAny, A extends z.ZodArray<T, any>>(
    array: A
  ) =>
    array.superRefine((items, ctx) => {
      if (new Set(items).size === items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each entry in the set must be an unique value",
        });
      }
      return z.NEVER;
    }),
};

// TODO: Use ZOD instead

/**Validation schema for configuring an application process */
const process = z
  .object({
    script: z.string(),
    cwd: z.string().nullable(),
    intepreter: z.string().nullable(),
    args: z.string().nullable(),
    env: z.record(z.union([z.string(), z.number()])).nullable(),
  })
  .strict();

/* Validation schema for a individual application configuration */
const application = z
  .object({
    label: z.string().regex(/[a-z\/]*/),
    process: process.nullable(),
    certificates: z
      .literal("lets-encrypt")
      .or(z.literal("self-signed"))
      .or(z.literal("default"))
      .default("default"),
  })
  .and(
    z.union([
      /* Application with redirection */
      z.object({
        redirect: z.string(),
      }),
      /* Application with static server */
      z.object({
        serve: z.string().nullable(),
      }),
      /* Application with a targeted port */
      z.object({
        port: z.number().int(),
      }),
    ])
  )
  .and(
    z.union([
      /* Application with single hostname */
      z.object({
        hostname: ze.hostname(),
      }),
      /* Application with several hostnames */
      z.object({
        hostnames: ze.uniqueArray(z.array(ze.hostname())),
      }),
    ])
  );

/** Validation schema for the application configuration file */
const applicationConfiguration = ze.yaml(
  ze.uniqueArray(z.array(application).nonempty())
);

/**
 * Validates the given text contents for a valid YAML configuration
 * of applications and returns it as a JSON object
 */
export function validateAppConfig(
  contents: string
): Array<Configuration.Application> {
  const results = applicationConfiguration.safeParse(contents);

  // Output any problems with the apps.yaml file and raise and error
  if (!results.success) {
    // Output
    console.error(`  There are errors in the configuration file:`);
    console.error(`  Fix the following errors:\n`);
    const errors = results.error.format()._errors;

    console.error(JSON.stringify(results.error.flatten(), null, 2));

    for (const error of errors) {
      console.error(`    `, error);
    }
    console.error("");

    // Raise the problem
    throw new Error("The app configuration file is invalid");
  }

  return results.data as any;
}

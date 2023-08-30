import * as Ajv from "ajv";
import * as AjvFormats from "ajv-formats";
import * as Yaml from "yaml";

/** Validation schema for a hostname anywhere in the apps config */
const hostnameSchema: Ajv.JSONSchemaType<Hostname> = {
  type: "string",
  format: "hostname",
};

/** Validation schema for the process enty of an app config */
const processSchema: Ajv.JSONSchemaType<Process> &
  any /* NOTE: any needed for key:value "env" */ = {
  type: "object",
  properties: {
    script: { type: "string" },
    cwd: { type: "string", nullable: true },
    intepreter: { type: "string", nullable: true },
    args: { type: "string", nullable: true },
    env: {
      type: "object",
      additionalProperties: { anyOf: [{ type: "string" }, { type: "number" }] },
      nullable: true,
    },
  },
  required: ["script"],
  additionalProperties: false,
};

/** Validation schema for the routing enrty of an app config */
const routingSchema: Ajv.JSONSchemaType<Routing> & any = {
  type: "object",
  oneOf: [
    {
      properties: {
        redirects: {
          type: "array",
          items: hostnameSchema,
          minItems: 1,
          uniqueItems: true,
          nullable: true,
        },
        directory: { type: "string", nullable: true },
        hostname: { ...hostnameSchema, nullable: true },
      },
      required: ["port", "hostname"],
      additionalProperties: false,
    },
    {
      properties: {
        redirects: { type: "array", items: hostnameSchema, nullable: true },
        directory: { type: "string", nullable: true },
      },
      additionalProperties: false,
    },
  ],
};

/** Validation schema for a single app config */
const appSchema: Ajv.JSONSchemaType<App> & any = {
  type: "object",
  properties: {
    label: { type: "string", pattern: "[^s-]" },
    port: { type: "integer" },
    process: processSchema,
    routing: routingSchema,
    redirect: { type: "string" },
    hostname: { ...hostnameSchema, nullable: true },
    hostnames: {
      type: "array",
      items: hostnameSchema,
      minItems: 1,
      uniqueItems: true,
    },
  },
  anyOf: [
    // to Redirect
    {
      required: ["redirect"],
      anyOf: [{ required: ["hostname"] }, { required: ["hostnames"] }],
    },
    // to Port
    {
      required: ["port"],
      anyOf: [{ required: ["hostname"] }, { required: ["hostnames"] }],
    },
    // No hostname
    {
      anyOf: [
        {
          required: ["process"],
        },
        {
          required: [],
        },
      ],
    },
  ],
  required: ["label"],
  additionalProperties: false,
};

/** Validation schema for a apps config file */
const appConfigSchema: Ajv.JSONSchemaType<AppsConfig> = {
  type: "array",
  items: appSchema,
  minItems: 0,
  uniqueItems: true,
};

/** The app config configuration */
type AppsConfig = Array<App>;

/**
 * Validates the given text if it contains valid YAML for the application configuration
 * and returns it as a JSON object
 */
export function validateAppConfig(contents: string): AppsConfig {
  const ajv = new Ajv.default();
  AjvFormats.default(ajv);
  const validator = ajv.compile(appConfigSchema);
  const config = Yaml.parse(contents);
  const isValid = validator(config);

  // Output any problems with the apps.yaml file and raise and error
  if (!isValid) {
    // Output
    console.error(`  There are errors in the configuration file:`);
    console.error(`  Fix the following errors:\n`);
    const errors = validator!.errors!;

    for (let i = errors.length - 1; i >= 0; i--) {
      const err = errors[i];
      const index = err.instancePath.split("/")[1];
      const entry = config[index];
      const prefix = `${entry && entry.label ? entry.label : ""}${
        err.instancePath
      }`;
      console.error(`${prefix}: ${err.message}`);
    }
    console.error("");

    // Raise the problem
    throw new Error("The apps.yaml file is invalid");
  }

  return config;
}

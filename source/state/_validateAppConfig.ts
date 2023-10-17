import * as Ajv from "ajv";
import * as AjvFormats from "ajv-formats";
import * as Yaml from "yaml";

// Validation schemas for Application properties

const label: Ajv.JSONSchemaType<string> = { type: "string", pattern: "[^s-]" };
const redirect: Ajv.JSONSchemaType<string> = { type: "string" };
const certificates: Ajv.JSONSchemaType<string> = {
  type: "string",
  isCertificate: true,
};
const serve: Ajv.JSONSchemaType<string> = { type: "string", nullable: true };
const port: Ajv.JSONSchemaType<number> = { type: "integer" };
const hostname: Ajv.JSONSchemaType<string> = {
  type: "string",
  format: "hostname",
  nullable: true,
};
const hostnames: Ajv.JSONSchemaType<Array<string>> = {
  type: "array",
  items: hostname,
  minItems: 1,
  uniqueItems: true,
};

/** Validation schema for configuring an application process */
const process: Ajv.JSONSchemaType<Configuration.Application["process"]> & any =
  {
    type: "object",
    properties: {
      script: { type: "string" },
      cwd: { type: "string", nullable: true },
      intepreter: { type: "string", nullable: true },
      args: { type: "string", nullable: true },
      env: {
        type: "object",
        additionalProperties: {
          anyOf: [{ type: "string" }, { type: "number" }],
        },
        nullable: true,
      },
    },
    required: ["script"],
    additionalProperties: false,
  };

/** Validation schema for a individual application */
const application: Ajv.JSONSchemaType<Configuration.Application> & any = {
  type: "object",
  properties: {
    label,
    process,
    serve,
    port,
    redirect,
    certificates,
    hostname,
    hostnames,
  },
  anyOf: [
    // to Redirect
    {
      required: ["redirect"],
      anyOf: [{ required: ["hostname"] }, { required: ["hostnames"] }],
    },
    // to Static File Serve
    {
      required: ["serve"],
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

/** Validation schema for the application configuration file */
const applicationConfiguration: Ajv.JSONSchemaType<
  Array<Configuration.Application>
> = {
  type: "array",
  items: application,
  minItems: 0,
  uniqueItems: true,
};

/**
 * Validates the given text contents for a valid YAML configuration
 * of applications and returns it as a JSON object
 */
export function validateAppConfig(
  contents: string
): Array<Configuration.Application> {
  const ajv = new Ajv.default();
  AjvFormats.default(ajv);

  // AJV Custom validators
  const availableCertificateTypes = ["lets-encrypt", "self-signed"];
  ajv.addKeyword({
    keyword: "isCertificate",
    type: "string",
    error: {
      message: `Must be an available way to retrive a certificate: "${availableCertificateTypes.join(
        `", "`
      )}",`,
    },
    validate: (_: any, data: string) => {
      return availableCertificateTypes.includes(data);
    },
  });

  const validator = ajv.compile(applicationConfiguration);
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
    throw new Error("The app configuration file is invalid");
  }

  return config;
}

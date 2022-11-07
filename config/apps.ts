import * as Yaml from 'yaml';
import * as Chokidar from 'chokidar';
import * as FS from 'fs';
import * as Path from 'path';
import * as Ajv from "ajv"
import * as AjvFormats from "ajv-formats"
import { PATH_TO_APPS } from './settings';

/** Validation schema for a hostname anywhere in the apps config */
const hostnameSchema: Ajv.JSONSchemaType < Hostname > = {
   type: "string",
   format: "hostname"
};

/** Validation schema for the process enty of an app config */
const processSchema: Ajv.JSONSchemaType < Process > & any /* NOTE: any needed for key:value "env" */ = {
   type: "object",
   properties: {
      script: { type: "string" },
      cwd: { type: "string", nullable: true },
      intepreter: { type: "string", nullable: true },
      args: { type: "string", nullable: true },
      env: {
         type: "object",
         additionalProperties: { anyOf: [{ type: "string" }, { type: "number" }] },
         nullable: true
      }
   },
   required: ["script"],
   additionalProperties: false
};

/** Validation schema for the routing enty of an app config */
const routingSchema: Ajv.JSONSchemaType < Routing > & any = {
   type: "object",
   oneOf: [{
         properties: {
            port: { type: "integer" },
            redirects: { type: "array", items: hostnameSchema, minItems: 1, uniqueItems: true, nullable: true },
            directory: { type: "string", nullable: true  },
            hostname: { ...hostnameSchema, nullable: true }
         },
         required: ["port", "hostname"],
         additionalProperties: false
      },
      {
         properties: {
            port: { type: "integer" },
            redirects: { type: "array", items: hostnameSchema, nullable: true },
            directory: { type: "string", nullable: true  },
            hostnames: {
               type: "array",
               items: hostnameSchema,
               minItems: 1,
               uniqueItems: true
            }
         },
         required: ["port", "hostnames"],
         additionalProperties: false
      }
   ]
};

/** Validation schema for a single app config */
const appSchema: Ajv.JSONSchemaType < App > = {
   type: "object",
   properties: {
      name: { type: "string" },
      label: { type: "string", pattern: "[^\s-]" },
      process: processSchema,
      routing: routingSchema,
   },
   required: ["name", "label"],
   additionalProperties: false
}

/** Validation schema for a standalone redirection config */
const redirectionSchema: Ajv.JSONSchemaType < Redirection > = {
   type: "object",
   properties: {
      name: { type: "string" },
      from: hostnameSchema,
      to: { type: "string" }
   },
   required: ["name", "from", "to"],
   additionalProperties: false
}

/** Validation schema for a apps config file */
const configSchema: Ajv.JSONSchemaType < AppsConfig > = {
   type: "object",
   properties: {
      redirects: { type: "array", items: redirectionSchema, minItems: 0, uniqueItems: true, nullable: true },
      apps: { type: "array", items: appSchema, minItems: 0, uniqueItems: true }
   },
   required: ["apps"],
   additionalProperties: false
};

/** The path to the apps.yaml file */
const appsPath = Path.resolve(PATH_TO_APPS , 'apps.yaml');

/** Reads, validates and returns the app configuration from "apps.yaml" ~ exits the program if its invalid */
export const readAppConfig = () : AppsConfig => {
   
   // Setup the config data validator
   const ajv = new Ajv.default();
   AjvFormats.default(ajv);
   
   const validate = ajv.compile(configSchema);
   const contents = FS.readFileSync(appsPath, 'utf-8');
   const config = Yaml.parse(contents);
   const isValid = validate(config);
   
   // Output any problems with the apps.yaml file and raise and error 
   if (!isValid) {
      
      // Output
      console.error(`  There are errors in the configuration file:`);
      console.error(`  Fix the following errors:\n`);
      const errors = validate!.errors!;
      
      for (let i = errors.length-1; i>=0; i--) {
         const err = errors[i];
         const prefix = Object.values(err.params).join('').length ? `  ${Object.values(err.params).join(" ")}: ` : "  ";
         console.error(`${prefix}${err.instancePath}: ${err.message}`);
      }
      console.error("");
      
      // Raise the problem
      throw "The apps.yaml file is invalid";
   }
   
   return config
}

/** Creates a watcher that calls the given callback when the apps.yaml file changes */
export const watchAppConfig = (callback: () => void) => {
   return Chokidar.watch(appsPath).on('change', callback);
}
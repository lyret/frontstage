import { Models } from "../database";
import { InternalProcesses, ApplicationProcesses } from "../processes";

/** The current runtime information available from the database and integrated services */
export type CurrentRuntimeInfo = {
  /** List of all configured redirections */
  redirects: Array<Routes.Redirection>;
  /** List of all existing internal routes */
  internalRoutes: Array<Routes.InternalRoute>;
  /** List of all certificates that should exist */
  certificates: Array<{
    label: string;
    renewalMethod: Certificates.LoadedCertificate["renewalMethod"];
    hostname: string;
  }>;
  /** List of all application daemons that are running */
  applicationProcesses: Array<{
    label: string;
    process: Process.Status;
  }>;
  /** List of all internal server manager daemons that are running */
  internalProcesses: Array<{
    label: string;
    process: Process.Status;
  }>;
  /** List of all internal ports registered */
  uniquePorts: Array<number>;
  /** List of all unique application labels registered */
  uniqueLabels: Array<string>;
};

/**
 * Collects the current information about how the server manager operates from the
 * database and integrated services
 */
export async function getCurrentRuntimeInformation(): Promise<CurrentRuntimeInfo> {
  // Create the resulting runtime information object
  const info: CurrentRuntimeInfo = {
    redirects: [],
    internalRoutes: [],
    certificates: [],
    applicationProcesses: [],
    internalProcesses: [],
    uniqueLabels: [],
    uniquePorts: [],
  };

  // Find all existing redirects
  const redirectionsDB = await Models.Redirections();
  info.redirects = (await redirectionsDB.findAll()).map((m) => m.toJSON());

  // Find all existing internal routes
  const internalRoutesDB = await Models.InternalRoutes();
  info.internalRoutes = (await internalRoutesDB.findAll()).map((m) =>
    m.toJSON()
  );

  // Find all existing certificates
  const certificatesDB = await Models.Certificates();
  info.certificates = (await certificatesDB.findAll()).map((m) => m.toJSON());

  // Find all existing internal processes
  info.internalProcesses = (await InternalProcesses.list()).map((status) => ({
    label: status.label,
    process: status,
  }));

  // Find all existing application processes
  info.applicationProcesses = (await ApplicationProcesses.list()).map(
    (status) => ({
      label: status.label,
      process: status,
    })
  );

  // Find all unique labels and ports
  for (const redirect of info.redirects) {
    if (!info.uniqueLabels.includes(redirect.label)) {
      info.uniqueLabels.push(redirect.label);
    }
  }
  for (const internalRoute of info.internalRoutes) {
    if (!info.uniqueLabels.includes(internalRoute.label)) {
      info.uniqueLabels.push(internalRoute.label);
    }
    if (!info.uniquePorts.includes(internalRoute.port)) {
      info.uniquePorts.push(internalRoute.port);
    }
  }
  for (const certificate of info.certificates) {
    if (!info.uniqueLabels.includes(certificate.label)) {
      info.uniqueLabels.push(certificate.label);
    }
  }
  // for (const internalProcess of info.internalProcesses) {
  //   if (!info.uniqueLabels.includes(internalProcess.label)) {
  //     info.uniqueLabels.push(internalProcess.label);
  //   }
  // }
  for (const applicationProcess of info.applicationProcesses) {
    if (!info.uniqueLabels.includes(applicationProcess.label)) {
      info.uniqueLabels.push(applicationProcess.label);
    }
  }

  // Return the existing state from the database
  return info;
}

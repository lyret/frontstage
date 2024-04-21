import { getDNSRecordsFromLoopia } from "./_loopia";
import { createLogger } from "../messages";
import { State } from "../state";

/** Logger */
const logger = createLogger("Domain Zone Records");

/** In-memory collection of loaded domain zone records */
const loadedRecords = new Map<number, DNS.Record>();

/** Lists all loaded dns records  */
export async function list(): Promise<Array<DNS.Record>> {
	try {
		if (!loadedRecords.size) {
			// Load dns records from Loopia
			if (State.Manager.dns_records.loopia) {
				logger.info("Asking Loopia for dns records");
				const records = await getDNSRecordsFromLoopia();
				for (const record of records) {
					loadedRecords.set(record.id, record);
				}
			}
		}
	} catch (err) {
		logger.error("Failed to load/list dns records", err);
	}
	return Array.from(loadedRecords.values());
}

/** Loads dns records from registered services  */
export async function load(): Promise<void> {
  try {
      // Load dns records from Loopia
      if (State.Manager.dns_records.loopia) {
        logger.info("Asking Loopia for dns records");
        const records = await getDNSRecordsFromLoopia();
        for (const record of records) {
          loadedRecords.set(record.id, record);
        }
      }
  } catch (err) {
    logger.error("Failed to load/list dns records", err);
  }
}

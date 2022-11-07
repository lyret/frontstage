import * as FSE from 'fs-extra';
import * as Path from 'path';

/**
 * Creates an Asset for creating and accessing files in a directory
 * in the file system
 * The directory is given on creation, file paths given
 * as parameters are relative to the directory
 */
export const FileDirectoryCollection : AssetGenerator<{
	/** Path to the file system directory to use for storage */
	path: string
}, {
	get: (path: string) => string | undefined
	set: (path: string, value: string) => void
	remove: (path: string) => void
	exists: (path: string) => boolean
}> = (options) => {

	// Make sure the file path to the directory exists
	FSE.ensureDir(options.path);

	return ({
		get: (filePath) => {
			const path = Path.join(options.path, filePath);
			if (!FSE.existsSync(path)) {
				return undefined;
			}
			return FSE.readFileSync(path, { encoding: 'utf-8', flag: 'r' }).toString();
		},
		set: (filePath, value) => {
			const path = Path.join(options.path, filePath);
			FSE.ensureFileSync(path);
			FSE.writeFile(path, value, { encoding: 'utf-8' });
		},
		remove: (filePath: string) => {
			const path = Path.join(options.path, filePath);
			FSE.removeSync(path);
		},
		exists: (path) => {
			return (FSE.existsSync(path));
		},
		close: () => {

		}
	})
}
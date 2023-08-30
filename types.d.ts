export {};

// TODO: Does not need to be global
declare global {
  type Hostname = string;

  interface Process {
    script: string;
    cwd?: string;
    intepreter?: string;
    args?: string;
    env?: {
      [key: string]: string | number;
    };
  }

  interface Routing {
    directory?: string;
    redirects?: Array<Hostname>;
  }

  interface App {
    label: string;
    port: number;
    hostname?: Hostname;
    hostnames?: Array<Hostname>;
    process: Process;
    routing: Routing;
    redirect: string;
  }

  // ASSETS

  type Asset<T extends object = {}> = T & {
    close: () => void;
  };

  type AssetOf<T extends AssetGenerator<any, any>> = ReturnType<T>;

  type AssetGenerator<
    Options extends object = {},
    AssetDefinition extends object = {}
  > = (options: Options) => Asset<AssetDefinition>;

  type AssetGeneratorWithoutOptions<AssetDefinition extends object = {}> =
    () => Asset<AssetDefinition>;
}

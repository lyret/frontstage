export {};

declare global {
   type Hostname = string;

   interface Process {
      script: string
      cwd ? : string
      intepreter ? : string
      args ? : string
      env ? : {
         [key: string]: string | number
      }
   }

   interface Routing {
      port: number
      directory?: string
      redirects ? : Array < Hostname >
      hostname ? : Hostname
      hostnames ? : Array < Hostname >
   }

   interface App {
      name: string
      label: string
      process: Process
      routing: Routing
   }
   
   interface Redirection {
      name: string
      from: string
      to: string
   }

   interface AppsConfig {
      apps: Array < App >
      redirects?: Array<Redirection> 
   }
   
   
   // ASSETS
   
   type Asset < T extends object = {} > = T & {
     close: () => void
   }
   
   type AssetOf <T extends AssetGenerator<any, any>> = ReturnType<T>
   
   type AssetGenerator<Options extends object = {}, AssetDefinition extends object = {}> = (options: Options) => Asset<AssetDefinition>;
   
   type AssetGeneratorWithoutOptions<AssetDefinition extends object = {}> = () => Asset<AssetDefinition>;
}
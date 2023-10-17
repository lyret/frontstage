// TODO (2024): continue with the ftp access module: https://www.npmjs.com/package/@nearst/ftp
// import * as Path from "node:path";
//
// // Quick start, create an active ftp server.
// import { FtpServer } from "ftp-srv";
//
// const port = 3000;
// const ftpServer = new FtpSrv({
//   url: "ftp://127.0.0.1:" + port,
//   anonymous: false,
// });
//
//
// ftpServer.on("login", ({ username, password }, resolve, reject) => {
//   if (username === "abc" && password === "123") {
//     return resolve({ root: "./apps" });
//   }
//   return reject(new ftpServer. .GeneralError("Invalid username or password", 401));
// });
//
// ftpServer.listen().then(() => {
//   console.log("Ftp server is starting...");
// });

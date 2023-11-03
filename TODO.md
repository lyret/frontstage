# TODO:

---

Anrop till IP adressen bör hanteras speciellt, cert behöver inte tittas upp etc

När Lets encrypt ändras från staging till production behöver gamla cert invalideras

Kontrollera tillgängligheten till servern via nätverket

---

## Körbarhet 1.0

- [ ] Se till att global state uppdaterar interna processer korrekt

- [ ] Alla +program.ts funktioner ska finnas och fungera
- [ ] Se över all loggning
- [ ] Gör klar alla +program.ts funktion med stöd för att kontrollera pm2 mm
- [ ] Testa processhanteraren ordentligt

## Funktioner som borde finnas

- [ ] Introducera randomness för lets encrypt, undvik 00.00 och hela timmar

## Funktioner som behövs

- [ ] Skaru.se behöver stöd för wilda subdomäner vilket inte alls fungerar

## Funktioner jag vill ha

- [ ] Ersätta Goatcounter med inbyggd funktionalitet

## Dokumentation

- [ ] Skapa dokumentation
- [ ] Ersätt alla console.log med logger funktioner

### Designflöden att skapa + tester

- [ ] Request flow (socket, http, https)
- [ ] Lets encrypt flow + self signed flow
- [ ] process management flow
- [ ] state update flow

---

## Ideas and roadmap for version 2024

- [ ] Alerts using web notifications or similar

- [ ] Centerialized

- [ ] Communicate with the manager directly over ssh or other protocol

- [ ] Support for string interpolation or tokens, to add variables in the config, like using the same port on both apps ENV or shell command and the hostname config

- [ ] Remove PM2 and use this program to keep other processes running

- [ ] Clustering support

- [ ] Add runnable FTP server access

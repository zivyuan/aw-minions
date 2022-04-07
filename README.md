- [Alien Worlds Minions](#alien-worlds-minions)
  - [TODO](#todo)
  - [Install and run](#install-and-run)
  - [CLI Options](#cli-options)
  - [About ProtocolError](#about-protocolerror)


# Alien Worlds Minions

**A mining bot for Alien Worlds, was created for research purposes only, the developers and contributors take no responsibility for your WAX.io, AlienWorlds and, or other social accounts.**

## TODO

- [ ] Resolve email 2FA validation
- [x] Intelligent next mint attempt
  - [x] Dynamic delay detect
  - [x] CPU resource best guess
- [ ] Multi account surpport, mining at same time
- [x] Tasking schedule
- [ ] Task types
  - [x] Wax Login
  - [x] AlienWorlds Login
  - [x] Mining
  - [ ] Account status, TLM amount and resouces useage of CPU, NET and RAM
  - [ ] Dingding report. Report mining progress on schedual

## Install and run

Download source code, open terminal and goto the source folder, then follow the steps below:

```
npm install

npm run build

node main.js -u your-username -p your-password
```

More command line options see **CLI Options** section

## CLI Options

Command line Options

```
      --version   Show version
  -u, --username  Username, required. Multi accouts surpported
  -p, --password  Password, required. Must pair with username
      --endpoint  Develop option, use a shared chromium instance for fast load
      --accounts  Account pool json file
      --proxy     Use proxy. Default is `127.0.0.1:7890`
                  ie: `--proxy address` or just `--proxy` to use default address
      --help      Show helps
```

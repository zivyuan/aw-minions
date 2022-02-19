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

## About ProtocolError
Error detail:
```
/home/------/aw-minions/node_modules/puppeteer/lib/cjs/puppeteer/common/HTTPResponse.js:129
                        throw new Errors_js_1.ProtocolError('Could not load body for this request. This might happen if the request is a preflight request.');
                              ^

ProtocolError: Could not load body for this request. This might happen if the request is a preflight request.
    at /home/------/aw-minions/node_modules/puppeteer/lib/cjs/puppeteer/common/HTTPResponse.js:129:31
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async HTTPResponse.text (/home/------/aw-minions/node_modules/puppeteer/lib/cjs/puppeteer/common/HTTPResponse.js:141:25)
    at async HTTPResponse.json (/home/------/aw-minions/node_modules/puppeteer/lib/cjs/puppeteer/common/HTTPResponse.js:154:25)
```

This error is not properly caught now, the corresponding solution is to use a loop script that automatically restarts the task after the error occurs

Final script like below:

```SHell
while (true);
do
  node main.js -a account -u wax-account@email.com -p password;
  sleep 5m;
done
```


# Alien Worlds Robot

## TODO

- [ ] Email client, surpport WAX Login Verification Code
- [ ] Intelligent next mint attempt
  - [ ] Dynamic delay detect
  - [ ] CPU resource best guess
- [ ] Multi account surpport, mining at same time
- [ ] Tasking schedule
- [ ] Add task report
- [ ] Task types
  - [ ] Restore cookie task


## About task

A task consists of one or more steps to implement a function, such as mining.

A step implements a single function and is the smallest unit of task execution. Each step should be allowed to be executed independently of the task it belongs to, which will bring great flexibility.

## CLI Options

Command line Options
```
      --version   Show version
  -u, --username  Username, required. Multi accouts surpported
  -p, --password  Password, required. Must pair with username
      --endpoint  Develop option, use a shared chromium instance for fast load
      --accounts  Account pool json file
      --proxy     Use SwitchOmega proxy
      --help      Show helps
```

## Usage

## Proxy

If SwitchyOmega extension enabled, must select proxy type to **[Auto switch]** by manual.

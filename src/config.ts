const winWid = 1280
const winHei = 840

export default {
  //
  tickInterval: 200,
  taskPhaseTimeout: 365 * 24 * 60 * 60 * 1000,
  browserOption: {
    headless: false,
    timeout: 0,
    deviceScaleFactor: 2,
    ignoreDefaultArgs: ["--enable-automation"],
    defaultViewport: null,
    args: [
      `--window-size=${winWid},${winHei}`,
      "--unhandled-rejections=strict",
    ],
  },
  proxy: {
    protocol: 'socks5',
    host: '127.0.0.1',
    port: '7890'
  },
  mining: {
    // Coll down second when resource low
    lowResourceCoolDown: 30
  },
  //
  dingding: {
    webhook: 'https://oapi.dingtalk.com/robot/send?access_token=9af84564bfffabbbbf76053b3aa5393901a46e838f3f173c393d1fc6b9f76f2b',
    secret: "SEC2d08891ffd4e42be8d4b5c1e136f63e3388eeab82a94045f743755a2796e3629",
  },
  minion: {
    // Delays between two task, default 30 second
    taskInterval: 30
  }
}

import fs from 'fs'
import path from 'path'
import { merge } from 'merge-anything'

const winWid = 1280
const winHei = 600

const confJson = path.resolve('./minions.json')

let customConf = {}
if (fs.existsSync(confJson)) {
  let content = fs.readFileSync(confJson).toString().trim()
  content = content.replace(/[\t ]+\/\/.*(\r|\n|\r\n)/g, '')
  try {
    customConf = JSON.parse(content)
    // eslint-disable-next-line no-empty
  } catch (err) { }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conf = <any>merge({
  //
  timezone: 'Asia/Shanghai',
  datetimeFormat: 'YYYY-MM-DD HH:mm:ss',
  tickInterval: 500,
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
    // Delay for out of esource, default 1 hour
    outOfResourceDelay: 60 * 60,
    // 120 seconds
    timeout: 120,
  },
  //
  dingding: {
    webhook: "",
    secret: "",
  },
  minion: {
    // Delays between two task, default 30 seconds
    taskInterval: 30,
    // Window lock timeout, default is 3 minutes
    windowLockTimeout: 3 * 60,
  },
  log: {
    timestamp: 'HH:mm:ss'
  },
  report: {
    interval: 8 * 60 * 60 * 1000
  }
}, customConf)

export default conf

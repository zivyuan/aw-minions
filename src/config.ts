import fs from 'fs'
import path from 'path'

const winWid = 1280
const winHei = 840

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

const conf = Object.assign({
  //
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
    // Coll down second when resource low
    outOfResourceDelay: 30 * 60,
    awakeDelay: 30,
  },
  //
  dingding: {
    webhook: "",
    secret: "",
  },
  minion: {
    // Delays between two task, default 30 second
    taskInterval: 30
  },
  log: {
    timestamp: 'HH:mm:ss'
  },
  report: {
    interval: 8 * 60 * 60 * 1000
  }
}, customConf)

export default conf

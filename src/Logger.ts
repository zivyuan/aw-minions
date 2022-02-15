import moment from "moment"
import config from "./config"


let _scopeMaxLen = 10

export default class Logger {
  // Wax block chain account
  static account = ''
  static debug = false

  private _scope: string
  public debug: (...args) => void

  constructor(scope?: string) {
    this.setScope(scope || '-')

    if (Logger.debug) {
      this.debug = (...args) => {
        console.log.apply(null, ([{_:scope}]).concat(args))
      }
    } else {
      this.debug = () => { }
    }
  }

  setScope(scope: string) {
    this._scope = scope.trim()
    _scopeMaxLen = Math.max(this._scope.length, _scopeMaxLen)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prefix(args: any[]): any[] {
    const conf = config.log
    const time = moment().format(conf.timestamp)
    const acc = Logger.account ? `[${Logger.account}]` : ''
    const prefix = Math.ceil((_scopeMaxLen - this._scope.length) / 2)
    const suffix = _scopeMaxLen - this._scope.length - prefix
    const blank = '                                               '
    const scope = `${blank.substring(0, prefix)}${this._scope}${blank.substring(0, suffix)}`
    const prefixs = [`[${time}]${acc}[${scope}]`]
    return prefixs.concat(args)
  }

  log(...args) {
    console.log.apply(null, this.prefix(args))
  }

  info(...args) {
    console.info.apply(null, this.prefix(args))
  }

  warn(...args) {
    console.warn.apply(null, this.prefix(args))
  }

  error(...args) {
    console.error.apply(null, this.prefix(args))
  }

}

import moment from "moment"

export default class Logger {
  // Wax block chain account
  static account = ''

  private _scope: string
  private _fixLenScope: string

  constructor(scope?: string) {
    this.setScope(scope || '')
  }

  setScope(scope: string) {
    this._scope = scope
    this._fixLenScope = this._scope.length < 16
      ? `                ${this._scope}`.substring(this._scope.length)
      : this._scope
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prefix(args: any[]): any[] {
    const time = moment().format('HH:mm:SS')
    const acc = Logger.account ? `[${Logger.account}]` : ''
    const prefixs = [`[${time}]${acc}[${this._fixLenScope}]`]
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

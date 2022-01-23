export default class Logger {
  private _scope: string
  private _fixLenScope: string

  constructor(scope?: string) {
    this.setScope(scope || '')
  }

  setScope(scope: string) {
    this._scope = scope
    this._fixLenScope = this._scope.length < 10
      ? `          ${this._scope}`.substring(this._scope.length)
      : this._scope
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prefix(args: any[]): any[] {
    const prefixs = [`[${this._fixLenScope}]`]
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

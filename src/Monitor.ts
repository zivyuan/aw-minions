/**
 * Monitor page status
 */

import { Browser, Page } from "puppeteer"

export interface TriggerTester {
  (browser: Browser, page: Page): boolean
}

export default class Monitor {
  private _triggers: TriggerTester[]
  private _triggerNames: string[]
  private _browser: Browser
  private _page: Page

  setContext(browser: Browser, page: Page) {
    this._browser = browser
    this._page = page
  }

  registerTrigger(name: string, trigger: TriggerTester): void {
    const idx = this._triggerNames.indexOf(name)
    if (idx === -1) {
      this._triggers.push(trigger)
      this._triggerNames.push(name)
    }
  }

  start() {
    this.monitorLoop()
  }

  stop() {
    clearTimeout(this.monitorTimer)
  }

  private monitorTimer = 0
  private async monitorLoop() {
    for(let i = 0; i<this._triggers.length; i++) {
      const trigger = this._triggers[i]
      const rst = await trigger(this._browser, this._page)
      if (rst) {
        console.log('tigger:', this._triggerNames[i])
      }
    }
    clearTimeout(this.monitorTimer)
    this.monitorTimer = setTimeout(() => {
      this.monitorLoop()
    }, 200)
  }
}

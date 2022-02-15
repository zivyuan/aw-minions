import BaseTask, { TaskState } from "./BaseTask";
import Logger from "../Logger";
import { PAGE_ALIEN_WORLDS, PAGE_ALIEN_WORLDS_TESTER, URL_ALIEN_WORLDS, AW_API_GET_ACCOUNT } from "../utils/constant";
import { HTTPResponse, PageEmittedEvents } from "puppeteer";
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_MINING, IAccountInfo } from "../types";

export interface IAWLoginResult {
  account: string
  tlm: number
}

let logger
export default class AWLogin extends BaseTask<IAWLoginResult> {
  constructor() {
    super('AW Login')

    if (!logger) {
      logger = new Logger(this.name)
    }

    this.registerStep('login', this.stepLogin, true)

  }

  private async stepLogin() {
    logger.log('Start Alien Worlds login...')
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)

    const onDomLoaded = async () => {
      await page.waitForSelector('.css-yfg7h4 .css-t8p16t')
      await page.click('.css-yfg7h4 .css-t8p16t', {
        delay: 80
      })
    }

    const onResponse = async (resp: HTTPResponse) => {
      const url = resp.url()

      if (url.indexOf(AW_API_GET_ACCOUNT) > -1) {
        unregisterEvent()

        if (resp.ok()) {
          const dat = await resp.json()
          this.provider.setData(DATA_KEY_MINING, {
            cpuLimit: dat.cpu_limit,
            netLimit: dat.net_limit,
            cpuWeight: dat.cpu_weight,
            netWeight: dat.net_weight,
            ramQuota: dat.ram_quota,
            ramUsage: dat.ram_usage,
          })

          logger.log(`👽 ${dat.account_name} login success.`)
          this._shouldTerminate = true
          this.complete(TaskState.Completed)
        } else {
          logger.log('AW login fail. Retry after 5 minutes.')
          const awakeTime = new Date().getTime() + 5 * 60 * 1000
          this.complete(TaskState.Canceled, 'Data error', null, awakeTime)
        }
      }
    }

    const unregisterEvent = () => {
      page.off(PageEmittedEvents.DOMContentLoaded, onDomLoaded)
      page.off(PageEmittedEvents.Response, onResponse)
    }

    page.on(PageEmittedEvents.DOMContentLoaded, onDomLoaded)
    page.on(PageEmittedEvents.Response, onResponse)

    const title = await page.title()
    if (!PAGE_ALIEN_WORLDS_TESTER.test(title || '')) {
      const opts = {
        // Give 3 minutes to load resources
        timeout: 3 * 60 * 1000
      }
      page.goto(URL_ALIEN_WORLDS, opts)
        .catch(err => {
          console.log('alien page loaded')
          if (this.state === TaskState.Running) {
            // TODO: Page load over time, double check login status
            logger.log(err, err.message)
            const awakeTime = new Date().getTime() + 5 * 60 * 1000
            this.complete(TaskState.Canceled, err.message, null, awakeTime)
          }
        })
    } else {
      page.reload()
    }
  }

  prepare(): boolean {
    const data = this.provider.getData<IAccountInfo>(DATA_KEY_ACCOUNT_INFO)
    if (!data.logined) {
      this._message = 'Not login.'
    }
    return data.logined
  }
}

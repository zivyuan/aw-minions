import BaseTask, { TaskState } from "./BaseTask";
import { random } from "../utils/utils";
import { sleep } from 'sleep'
import { Page } from "puppeteer";
import Logger from "../Logger";
import config from "../config";

const CLS_BTN_MINE = '.css-1i7t220 .css-f33lh6 .css-10opl2l .css-t8p16t'
const CLS_BTN_CLAIM = '.css-1i7t220 .css-f33lh6 .css-1knsxs2 .css-t8p16t'
const CLS_BTN_COOLDOWN = '.css-1i7t220 .css-f33lh6 .css-2s09f0'
const CLS_TXT_COOLDOWN = '.css-1i7t220 .css-f33lh6 .css-2s09f0 .css-ov2nki'
// const CLS_TXT_NEXT_MINE = '.css-1i7t220 .css-f33lh6 .css-2s09f0 .css-1phfdwl'
const CLS_BTN_APPROVE = '.authorize-transaction-container .react-ripples button'

const STEP_MINE = 'mine'
const STEP_CLAIM = 'claim'
const STEP_APPROVE = 'apprive'
const STEP_CONFIRM = 'comfirm'

// 挖矿请求接口: https://aw-guard.yeomen.ai/v1/chain/push_transaction

// {
//   "code": 500,
//   "message": "Internal Service Error",
//   "error": {
//     "code": 3080004,
//     "name": "tx_cpu_usage_exceeded",
//     "what": "Transaction exceeded the current CPU usage limit imposed on the transaction",
//     "details": [
//       {
//         "message": "billed CPU time (375 us) is greater than the maximum billable CPU time for the transaction (234 us)",
//         "file": "transaction_context.cpp",
//         "line_number": 470,
//         "method": "validate_account_cpu_usage"
//       }
//     ]
//   }
// }


const logger = new Logger('Mining Task')

export interface IMiningResult {
  nextAttemptAt: number
  reward: number
  cpu?: number
  net?: number
  ram?: number
}

export default class Mining extends BaseTask<IMiningResult> {

  constructor() {
    super('Mining Task')

    this.registerStep(STEP_MINE, this.stepMine, true)
    this.registerStep(STEP_CLAIM, this.stepClaim)
    this.registerStep(STEP_APPROVE, this.stepApprove)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)
  }

  private async stepMine() {
    const btn = await this.page.$$(CLS_BTN_MINE)
    if (!btn.length) {
      this.tick(STEP_MINE)
      return
    }

    await this.page.click(CLS_BTN_MINE, {
      delay: 50 + random(200)
    })
    sleep(1)

    this.nextStep(STEP_CLAIM)
  }

  private async stepClaim() {
    const btn = await this.page.$$(CLS_BTN_CLAIM)
    if (!btn.length) {
      this.tick(STEP_CLAIM)
      return
    }

    await this.page.click(CLS_BTN_CLAIM, {
      delay: 1500 + random(5000)
    })
    sleep(1)

    this.nextStep(STEP_APPROVE)
  }

  private async stepApprove() {
    const pages = await this.browser.pages()
    let approvePage: Page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const btn = await page.$$(CLS_BTN_APPROVE)
      if (btn.length) {
        approvePage = page
        break;
      }
    }

    if (!approvePage) {
      this.tick(STEP_APPROVE)
      return
    }

    if (!approvePage.isClosed()) {
      try {
        await approvePage.click(CLS_BTN_APPROVE, {
          delay: 500 + random(2000)
        })

        // eslint-disable-next-line no-empty
      } catch (err) { }
    }
    sleep(2)

    this.nextStep(STEP_CONFIRM)
  }

  private async stepConfirm() {
    const btnMine = await this.page.$(CLS_BTN_MINE)

    if (btnMine) {
      // 资源不足了, 默认30分钟后再次尝试
      const message = `Resource low, add ${config.mining.lowResourceCoolDown} minute to cooldown`
      const seconds = 30 * 60 * 1000
      logger.log(message)
      const data: IMiningResult = {
        nextAttemptAt: new Date().getTime() + seconds,
        reward: 0
      }
      this.complete(TaskState.Abort, 'No enough resource to mining.', data)
      return
    }

    const btn = await this.page.$(CLS_BTN_COOLDOWN)

    if (!btn) {
      this.tick(STEP_CONFIRM)
      return
    }

    const txt = await this.page.$$(CLS_TXT_COOLDOWN)
    if (txt.length) {
      const countDown = await this.page.$eval(CLS_TXT_COOLDOWN, (item) => item.textContent)
      const seconds = countDown.split(':')
        .map((item, idx) => (parseInt(item) * ([3600, 60, 1][idx])))
        .reduce((a, b) => a + b) * 1000
      logger.log('Next mine count down: ', countDown)
      const data: IMiningResult = {
        nextAttemptAt: new Date().getTime() + seconds,
        reward: 0
      }
      this.complete(TaskState.Completed, '', data)

    } else {
      this.tick(STEP_CONFIRM)
    }

  }
}

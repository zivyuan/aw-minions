import BaseTask, { TaskState } from "./BaseTask";
import { random } from "../utils/utils";
import { sleep } from 'sleep'
import Logger from "../Logger";
import { PAGE_FILTER_SIGN } from "../utils/constant";
import moment from "moment";

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

const PAGE_TITLE = 'Alien Worlds'

export default class Mining extends BaseTask<IMiningResult> {

  constructor() {
    super('Mining Task')

    this.registerStep(STEP_MINE, this.stepMine, true)
    this.registerStep(STEP_CLAIM, this.stepClaim)
    this.registerStep(STEP_APPROVE, this.stepApprove)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)
  }

  private async stepMine() {
    const page = await this.provider.getPage(PAGE_TITLE)
    const btn = await page.$$(CLS_BTN_MINE)
    if (!btn.length) {
      this.tick(STEP_MINE)
      return
    }

    await page.click(CLS_BTN_MINE, {
      delay: 50 + random(200)
    })
    sleep(1)

    this.nextStep(STEP_CLAIM)
  }

  private async stepClaim() {
    const page = await this.provider.getPage(PAGE_TITLE)
    const btn = await page.$$(CLS_BTN_CLAIM)
    if (!btn.length) {
      this.tick(STEP_CLAIM)
      return
    }

    await page.click(CLS_BTN_CLAIM, {
      delay: 1500 + random(5000)
    })
    sleep(1)

    this.nextStep(STEP_APPROVE)
  }

  private async stepApprove() {
    const approvePage = await this.provider.getPage(PAGE_FILTER_SIGN, false, true)
    await approvePage.waitForSelector(CLS_BTN_APPROVE, { timeout: 5 * 60  * 1000})
    await approvePage.click(CLS_BTN_APPROVE, {
      delay: 500 + random(2000)
    })

    this.nextStep(STEP_CONFIRM)
  }

  private async stepConfirm() {
    const page = await this.provider.getPage(PAGE_TITLE)
    const btnMine = await page.$(CLS_BTN_MINE)

    if (btnMine) {
      // 资源不足了, 默认30分钟后再次尝试
      const seconds = 30 * 60 * 1000
      const awakeTime = new Date().getTime() + seconds + (Math.floor(Math.random() * 4 * 60 * 1000) + 600000)
      const data: IMiningResult = {
        nextAttemptAt: awakeTime,
        reward: 0
      }
      logger.log('Next mining attempt at ', moment(awakeTime).format('HH:mm'))
      this.complete(TaskState.Abort, 'No enough resource to mining.', data, awakeTime)
      return
    }

    const btn = await page.$(CLS_BTN_COOLDOWN)

    if (!btn) {
      this.tick(STEP_CONFIRM)
      return
    }

    const txt = await page.$$(CLS_TXT_COOLDOWN)
    if (txt.length) {
      const countDown = await page.$eval(CLS_TXT_COOLDOWN, (item) => item.textContent)
      const seconds = countDown.split(':')
        .map((item, idx) => (parseInt(item) * ([3600, 60, 1][idx])))
        .reduce((a, b) => a + b) * 1000
      // Set a random delay for every task
      const awakeTime = new Date().getTime() + seconds + (Math.floor(Math.random() * 4 * 60 * 1000) + 600000)
      logger.log('Next mining attempt at ', moment(awakeTime).format('HH:mm'))
      const data: IMiningResult = {
        nextAttemptAt: awakeTime,
        reward: 0
      }
      this.complete(TaskState.Completed, '', data, awakeTime)

    } else {
      this.tick(STEP_CONFIRM)
    }

  }
}

import BaseTask, { TaskState } from "./BaseTask";
import { random } from "../utils/utils";
import { sleep } from 'sleep'
import Logger from "../Logger";
import { PAGE_FILTER_SIGN } from "../utils/constant";
import moment from "moment";

const CLS_TXT_BALANCE = '.css-1tan345 .css-ov2nki'
const CLS_BTN_MINE = '.css-1i7t220 .css-f33lh6 .css-10opl2l .css-t8p16t'
const CLS_BTN_CLAIM = '.css-1i7t220 .css-f33lh6 .css-1knsxs2 .css-t8p16t'
// const CLS_BTN_COOLDOWN = '.css-1i7t220 .css-f33lh6 .css-2s09f0'
const CLS_TXT_COOLDOWN = '.css-1i7t220 .css-f33lh6 .css-2s09f0 .css-ov2nki'
// const CLS_TXT_NEXT_MINE = '.css-1i7t220 .css-f33lh6 .css-2s09f0 .css-1phfdwl'
const CLS_BTN_APPROVE = '.authorize-transaction-container .react-ripples button'

const STEP_PREPARE = 'prepare'
const STEP_MINE = 'mine'
const STEP_CLAIM = 'claim'
const STEP_APPROVE = 'approve'
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


const logger = new Logger('Mining')

export interface IMiningResult {
  nextAttemptAt: number
  total: number
  reward: number
  cpu?: number
  net?: number
  ram?: number
}

const PAGE_TITLE = 'Alien Worlds'

export default class Mining extends BaseTask<IMiningResult> {
  private _tlm = 0

  constructor() {
    super('Mining')

    this.registerStep(STEP_PREPARE, this.stepPrepare, true)
    this.registerStep(STEP_MINE, this.stepMine)
    this.registerStep(STEP_CLAIM, this.stepClaim)
    this.registerStep(STEP_APPROVE, this.stepApprove)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)
  }

  private async stepPrepare() {
    const page = await this.provider.getPage(PAGE_TITLE)
    await page.bringToFront()
    const cls = await page.$eval(CLS_TXT_BALANCE, item => item.textContent)
    this._tlm = parseFloat(cls)
    this.nextStep(STEP_MINE)
  }

  private async stepMine() {
    logger.log('Mining...')
    const page = await this.provider.getPage(PAGE_TITLE)
    await page.waitForSelector(CLS_BTN_MINE)
    await page.click(CLS_BTN_MINE, {
      delay: 50 + random(200)
    })
    sleep(1)

    this.nextStep(STEP_CLAIM)
  }

  private async stepClaim() {
    logger.log('Claiming...')
    const page = await this.provider.getPage(PAGE_TITLE)
    await page.waitForSelector(CLS_BTN_CLAIM)
    await page.click(CLS_BTN_CLAIM, {
      delay: 1500 + random(5000)
    })
    sleep(1)

    this.nextStep(STEP_APPROVE)
  }

  private async stepApprove() {
    logger.log('Waiting approve...')
    const approvePage = await this.provider.getPage(PAGE_FILTER_SIGN, true)
    await approvePage.bringToFront()

    approvePage.waitForSelector(CLS_BTN_APPROVE, { timeout: 2 * 60 * 1000 })
      .then(async () => {
        await approvePage.click(CLS_BTN_APPROVE, {
          delay: 500 + random(2000)
        })
        this.nextStep(STEP_CONFIRM)
      })
      .catch(async () => {
        logger.log('Claim timeout, retry...')
        await approvePage.close()
        this.nextStep(STEP_CLAIM)
      })
  }

  private async stepConfirm() {
    const page = await this.provider.getPage(PAGE_TITLE)
    await page.bringToFront()
    const btnMine = await page.$(CLS_BTN_MINE)
    const txtCoolDown = await page.$(CLS_TXT_COOLDOWN)

    if (!btnMine && !txtCoolDown) {
      this.tick(STEP_CONFIRM)
      return
    }

    let outOfCPU = false
    let total = 0
    let reward = 0
    let awakeTime = 0

    if (btnMine) {
      outOfCPU = true
      awakeTime = new Date().getTime() + 30 * 60 * 1000
    } else {
      const countDown = await page.$eval(CLS_TXT_COOLDOWN, (item) => item.textContent)
      const seconds = countDown.split(':')
        .map((item, idx) => (parseInt(item) * ([3600, 60, 1][idx])))
        .reduce((a, b) => a + b) * 1000
      awakeTime = new Date().getTime() + seconds + (Math.floor(Math.random() * 2.5 * 60 * 1000))
    }

    const tlm = await page.$eval(CLS_TXT_BALANCE, item => item.textContent)
    total = parseFloat(tlm)
    reward = Math.round((total - this._tlm) * 10000) / 10000

    const result: IMiningResult = {
      nextAttemptAt: awakeTime,
      total,
      reward,
    }

    if (outOfCPU) {
      logger.log('Ahhhhhhh~~hhh~~~~~~~~~, bana~~~nnnnana~~')
      logger.log(`Mining reward:  0 TLM, current total: ${total} TLM.`)
      logger.log(`Next mining attempt will be at ${moment(awakeTime).format('HH:mm')} almost.`)
      this.complete(TaskState.Abort, 'Out of CPU.', result, awakeTime)
    } else {
      logger.log(`${reward} trilium! La~~~lala~~~~~~~, ba~~~~nnnnnnana~~`)
      logger.log(`Mining reward: ${reward} TLM, current total: ${total} TLM.`)
      logger.log(`Next mining attempt will be at ${moment(awakeTime).format('HH:mm')} almost.`)
      this.complete(TaskState.Completed, 'Success', result, awakeTime)
    }
  }
}

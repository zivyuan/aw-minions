import BaseTask, { TaskState } from "./BaseTask";
import { getAwakeTime } from "../utils/utils";
import Logger from "../Logger";
import { PAGE_ALIEN_WORLDS, AW_API_GET_TABLE_ROWS, AW_API_PUSH_TRANSACTION } from "../utils/constant";
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_MINING, IAccountInfo, IMiningData } from "../types";
import { IMiningDataProvider } from "../Minion";
import { HTTPResponse, Page, PageEmittedEvents } from "puppeteer";
import moment from "moment";

// const CLS_TXT_BALANCE = '.css-1tan345 .css-ov2nki'
const CLS_BTN_MINE = '.css-1i7t220 .css-f33lh6 .css-10opl2l .css-t8p16t'
const CLS_BTN_CLAIM = '.css-1i7t220 .css-f33lh6 .css-1knsxs2 .css-t8p16t'
// const CLS_BTN_COOLDOWN = '.css-1i7t220 .css-f33lh6 .css-2s09f0'
const CLS_TXT_COOLDOWN = '.css-1i7t220 .css-f33lh6 .css-2s09f0 .css-ov2nki'
// const CLS_TXT_NEXT_MINE = '.css-1i7t220 .css-f33lh6 .css-2s09f0 .css-1phfdwl'
const CLS_BTN_APPROVE = '.authorize-transaction-container .react-ripples button'

const STEP_PREPARE = 'prepare'
const STEP_MINE = 'mine'
const STEP_CLAIM = 'claim'
const STEP_CONFIRM = 'comfirm'

enum MiningStage {
  None,
  Mine,
  Claim,
  Cooldown,
  Complete,
}


const logger = new Logger('Mining')

export interface IMiningResult {
  nextAttemptAt: number
  total: number
  reward: number
  cpu?: number
  net?: number
  ram?: number
}

export default class Mining extends BaseTask<IMiningResult> {

  static initial(provider: IMiningDataProvider) {
    const data = provider.getData<IMiningData>(DATA_KEY_MINING)
    data.counter = 0
    provider.setData(DATA_KEY_MINING, data)
  }

  private _tlm = -1
  private _miningStage = MiningStage.None
  private _miningSuccess = false
  private _account: IAccountInfo

  constructor() {
    super('Mining')

    this.registerStep(STEP_PREPARE, this.stepPrepare, true)
    this.registerStep(STEP_MINE, this.stepMine)
    this.registerStep(STEP_CLAIM, this.stepClaim)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)
  }

  private async getCurrentStage(): Promise<MiningStage> {
    let stage = MiningStage.None

    try {
      const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
      const btnMine = await page.$(CLS_BTN_MINE)
      const btnClaim = await page.$(CLS_BTN_CLAIM)
      const txtCooldown = await page.$(CLS_TXT_COOLDOWN)
      if (btnMine) {
        stage = MiningStage.Mine
      } else if (btnClaim) {
        stage = MiningStage.Claim
      } else if (txtCooldown) {
        stage = MiningStage.Cooldown
      }
    } catch (err) { }

    this._miningStage = stage

    return stage
  }

  private async getCooldown(page: Page): Promise<number> {
    const txtCooldown = await page.$eval(CLS_TXT_COOLDOWN, item => item.textContent)
    const multiplier = [60 * 60, 60, 1]
    const cooldown = txtCooldown.split(':')
      .map((item, idx) => (multiplier[idx] * parseInt(item)))
      .reduce((a, b) => a + b)
    return cooldown * 1000
  }

  private async stepPrepare() {
    const stage = await this.getCurrentStage()

    if (stage === MiningStage.Mine) {
      this.nextStep(STEP_MINE)
    }
    else if (stage === MiningStage.Claim) {
      this.nextStep(STEP_CLAIM)
    }
    else if (stage === MiningStage.Cooldown) {
      const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
      const cooldown = await this.getCooldown(page)
      const awakeTime = getAwakeTime(cooldown)
      logger.log('Tools cooldown, next mining scheduled at ' + (moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')))
      this.complete(TaskState.Canceled, 'Cooldown', null, awakeTime)
    }
    else {
      // Undetermined stage
      setTimeout(() => {
        this.stepPrepare()
      }, 3000);
    }
  }

  private async getBalance(resp: HTTPResponse): Promise<number> {
    const url = resp.url()
    if (url.indexOf(AW_API_GET_TABLE_ROWS) === -1) {
      return -1
    }

    if (!resp.ok()) {
      return -1
    }

    // Filter by request data
    const req = resp.request()
    // {
    //   "json": true,
    //   "code": "alien.worlds",
    //   "scope": "yekm2.c.wam",
    //   "table": "accounts",
    //   "lower_bound": "",
    //   "upper_bound": "",
    //   "index_position": 1,
    //   "key_type": "",
    //   "limit": 10,
    //   "reverse": false,
    //   "show_payer": false
    // }
    const postData = JSON.parse(req.postData())
    if (postData.scope !== this._account.account
      || postData.table !== 'accounts'
      || postData.code !== 'alien.worlds') {
      return -1
    }

    let tlm = -1
    try {
      const dat = await resp.json()
      tlm = parseFloat(dat.rows[0].balance)
    } catch (err) { }

    return isNaN(tlm) ? -1 : tlm;
  }

  private async stepMine() {
    const data = this.provider.getData<IMiningData>(DATA_KEY_MINING)
    logger.log(`👷 Ready for ${data.counter + 1}th mine`)

    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
    await page.bringToFront()

    const getBalance = async (resp: HTTPResponse) => {
      const tlm = await this.getBalance(resp)
      if (this._tlm === -1 && tlm >= 0) {
        this._tlm = tlm
        page.off(PageEmittedEvents.Response, getBalance)
        await page.click(CLS_BTN_MINE)
        logger.log(`⛏ Mining...`)

        this.nextStep(STEP_CLAIM)
      }
    }
    page.on(PageEmittedEvents.Response, getBalance)
  }

  private async stepClaim() {
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)

    const doApprove = async (popup: Page) => {
      const onApproved = () => {
        popup.off(PageEmittedEvents.Close, onApproved)
        popup.off(PageEmittedEvents.DOMContentLoaded, onApprovePageDom)

        unregisteEvents()

        this.nextStep(STEP_CONFIRM)
      }

      const onApprovePageDom = async () => {
        try {
          await popup.waitForSelector(CLS_BTN_APPROVE, { timeout: 5 * 60 * 1000 })
          await popup.click(CLS_BTN_APPROVE)
        } catch (err) {
          if (!popup.isClosed()) {
            setTimeout(() => {
              onApprovePageDom()
            }, 3000);
          }
        }
      }

      popup.on(PageEmittedEvents.Close, onApproved)
      popup.on(PageEmittedEvents.DOMContentLoaded, onApprovePageDom)

      page.on(PageEmittedEvents.Response, onPushTransaction)
    }

    const onPushTransaction = async (resp: HTTPResponse) => {
      const url = resp.url()
      if (url.indexOf(AW_API_PUSH_TRANSACTION) === -1) {
        return
      }
      this._miningStage = MiningStage.Complete
      this._miningSuccess = resp.ok()
      page.off(PageEmittedEvents.Response, onPushTransaction)
    }

    const unregisteEvents = () => {
      page.off(PageEmittedEvents.Popup, doApprove)
    }

    page.on(PageEmittedEvents.Popup, doApprove)

    try {
      await page.waitForSelector(CLS_BTN_CLAIM)
      await page.click(CLS_BTN_CLAIM)
      logger.log('🐝 Claiming...')
    } catch (err) {
      logger.log('Wait for CLS_BTN_CLAIM timeout')
      unregisteEvents()

      setTimeout(() => {
        this.stepClaim()
      }, 3000)
    }
  }

  private async stepConfirm() {
    logger.log('🐝 Confirming...')
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
    const checkBalance = async (resp: HTTPResponse) => {
      if (this._miningStage !== MiningStage.Complete
        || this.state !== TaskState.Running) {
        return
      }

      const tlm = await this.getBalance(resp)
      if (isNaN(tlm) || tlm < 0) {
        return
      }

      if (this._miningSuccess) {
        let reward = tlm - this._tlm
        // Reward must greater than 0
        if (reward <= 0) {
          return
        }
        this._tlm = tlm

        reward = Math.round(reward * 10000) / 10000
        let awakeTime
        try {
          await page.waitForSelector(CLS_TXT_COOLDOWN)
          const cooldown = await this.getCooldown(page)
          awakeTime = getAwakeTime(cooldown)
        } catch (err) {
          awakeTime = getAwakeTime(30 * 60 * 1000)
        }
        const awstr = moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')
        const result: IMiningResult = {
          nextAttemptAt: awakeTime,
          total: tlm,
          reward,
        }

        page.off(PageEmittedEvents.Response, checkBalance)
        this._miningStage = MiningStage.None

        const conf = this.provider.getData<IMiningData>(DATA_KEY_MINING)
        this.provider.setData(DATA_KEY_MINING, {
          total: tlm,
          rewards: conf.rewards + reward,
          counter: conf.counter + 1
        }, true)

        logger.log(`✨ ${reward} TLM mined, total ${tlm} TLM.`)
        logger.log(`Next mine attempt scheduled at ${awstr}`)
        this.complete(TaskState.Completed, 'Success', result, awakeTime)
      } else {
        const awakeTime = getAwakeTime(30 * 60 * 1000)
        const awstr = moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')
        const result: IMiningResult = {
          nextAttemptAt: awakeTime,
          total: tlm,
          reward: 0,
        }
        page.off(PageEmittedEvents.Response, checkBalance)
        logger.log(`Mining failed because of out of resource. Current total ${tlm} TLM.`)
        logger.log(`Next mine attempt scheduled at ${awstr}`)
        this.complete(TaskState.Completed, 'Out of resource', result, awakeTime)
      }
    }
    page.on(PageEmittedEvents.Response, checkBalance)
  }

  prepare(): boolean {
    const data = this.provider.getData<IAccountInfo>(DATA_KEY_ACCOUNT_INFO)
    if (!data.logined) {
      this._message = 'Not login.'
    }
    this._account = data
    return data.logined
  }
}

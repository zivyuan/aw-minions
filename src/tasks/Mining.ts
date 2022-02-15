import BaseTask, { TaskState } from "./BaseTask";
import { getAwakeTime, random } from "../utils/utils";
import Logger from "../Logger";
import { PAGE_ALIEN_WORLDS, AW_API_GET_TABLE_ROWS, AW_API_PUSH_TRANSACTION, TIME_5_MINITE, AW_API_ASSETS_INFO, TIME_MINITE, TIME_10_MINITE, TIME_HALF_HOUR } from "../utils/constant";
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_MINING, IAccountInfo, IMiningData } from "../types";
import { IMiningDataProvider } from "../Minion";
import { HTTPResponse, Page, PageEmittedEvents } from "puppeteer";
import moment from "moment";
import { responseGuard } from "../utils/pputils";
import { UTCtoGMT } from "../utils/datetime";
import config from "../config";

// const CLS_TXT_BALANCE = '.css-1tan345 .css-ov2nki'
const CLS_BTN_MINE = '.css-1i7t220 .css-f33lh6 .css-10opl2l .css-t8p16t'
const CLS_BTN_CLAIM = '.css-1i7t220 .css-f33lh6 .css-1knsxs2 .css-t8p16t'
const CLS_BTN_APPROVE = '.authorize-transaction-container .react-ripples button'

const STEP_PREPARE = 'prepare'
const STEP_MINE = 'mine'
const STEP_CLAIM = 'claim'
const STEP_CONFIRM = 'comfirm'


let logger

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

  private _account: IAccountInfo
  // Status
  private _pageReady = false
  private _balanceUpdated = false
  private _assetsUpdated = false
  private _bagUpdated = false
  private _mineStatusUpdated = false
  private _transactionUpdated = false
  private _readyEventFired = false


  private _balance = 0
  private _balanceChanged = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _assets: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _bagItems = {
    items: [],
    locked: 0
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _mineStatus: any = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _transaction: any = null
  private _transactionOk = false

  constructor() {
    super('Mining')

    if (!logger) {
      logger = new Logger(this.name)
    }

    this.registerStep(STEP_PREPARE, this.stepPrepare, true)
    this.registerStep(STEP_MINE, this.stepMine)
    this.registerStep(STEP_CLAIM, this.stepClaim)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)
  }

  private getCooldown(): number {
    const tools = this._bagItems.items.map(item => {
      const assets = this._assets.find(ast => ast.asset_id === item.asset_id)
      return assets ? assets : item
    })
    if (tools.length >= 3) {
      tools.sort((a, b) => (a.data.delay > b.data.delay ? 1 : -1))
    }
    const sum = tools.map((item, idx) => idx < 2 ? item.data.delay : 0).reduce((a, b) => a + b)
    const land = this._assets.find(ast => ast.asset_id === this._mineStatus.current_land)
    const cooldown = sum * (land.data.delay / 10)
    return cooldown * 1000
  }

  /**
   *
   *
   * Payload
   * ```
   *   {
   *     "json": true,
   *     "code": "m.federation",
   *     "scope": "m.federation",
   *     "table": "miners",
   *     "lower_bound": "4ryba.wam",
   *     "upper_bound": "4ryba.wam",
   *     "index_position": 1,
   *     "key_type": "",
   *     "limit": 10,
   *     "reverse": false,
   *     "show_payer": false
   *   }
   * ```
   * @param resp
   * @returns
   */
  private guardMineStatus = async (resp: HTTPResponse): Promise<boolean> => {
    const api = AW_API_GET_TABLE_ROWS
    const url = resp.url()
    if (url.indexOf(api) === -1) return false
    const req = resp.request()
    const payload = JSON.parse(req.postData())
    if (payload.table !== 'miners') return false
    if (payload.code !== 'm.federation') return false
    if (payload.lower_bound !== this._account.account) return false

    return true
  }

  /**
   *
   *
   * Payload
   * ```
   *   {
   *     "json": true,
   *     "code": "alien.worlds",
   *     "scope": "4ryba.wam",
   *     "table": "accounts",
   *     "lower_bound": "",
   *     "upper_bound": "",
   *     "index_position": 1,
   *     "key_type": "",
   *     "limit": 10,
   *     "reverse": false,
   *     "show_payer": false
   *   }
   * ```
   * @param resp
   * @returns
   */
  private guardBalance = async (resp: HTTPResponse): Promise<boolean> => {
    // if (!(await responseGuard(resp, AW_API_GET_TABLE_ROWS))) return false
    const req = resp.request()
    const payload = JSON.parse(req.postData())
    if (payload.table !== 'accounts') return false
    if (payload.code !== 'alien.worlds') return false
    if (payload.scope !== this._account.account) return false

    return true
  }


  /**
   *
   * @param resp
   * @returns
   */
  private guardAssetsInfo = async (resp: HTTPResponse): Promise<boolean> => {
    // if (!(await responseGuard(resp, AW_API_ASSETS_INFO))) return false
    const url = resp.url()
    const pat1 = `&collection_name=alien.worlds`
    if (url.indexOf(pat1) === -1) return false

    return true
  }

  /**
   *
   * Payload:
   *  {
   *    code: "m.federation"
   *    index_position: 1
   *    json: true
   *    key_type: ""
   *    limit: 10
   *    lower_bound: "4ryba.wam"
   *    reverse: false
   *    scope: "m.federation"
   *    show_payer: false
   *    table: "bags"
   *    upper_bound: "4ryba.wam"
   *  }
   * @param resp
   * @returns
   */
  private guardBagInfo = async (resp: HTTPResponse): Promise<boolean> => {
    // if (!(await responseGuard(resp, AW_API_ASSETS_INFO))) return false
    const req = resp.request()
    const payload = JSON.parse(req.postData())
    if (payload.table !== 'bags') return false
    if (payload.code !== 'm.federation') return false
    if (payload.lower_bound !== this._account.account) return false

    return true
  }

  private updateBalance = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_GET_TABLE_ROWS, this.guardBalance]))
      return

    const dat = await resp.json()
    const tlm = parseFloat(dat.rows[0].balance)
    if (tlm !== this._balance) {
      this._balanceChanged = tlm - this._balance
      this._balance = tlm

      logger.debug(`update balance: total ${this._balance.toFixed(4)} tlm, changed ${this._balanceChanged.toFixed(4)} tlm`)
      this._balanceUpdated = true
      this.fireReadyEvent()
    }
  }

  private updateAssetsInfo = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_ASSETS_INFO, this.guardAssetsInfo]))
      return

    const count = this._assets.length
    const dat = await resp.json()
    const newAssets = dat.data.filter(item =>
      (!this._assets.find(_t => _t.asset_id === item.asset_id))
    )
    this._assets = this._assets.concat(newAssets)

    if (this._assets.length !== count) {
      logger.debug('update assets', count, this._assets)
      this._assetsUpdated = true
      this.fireReadyEvent()
    }
  }

  private updateBagInfo = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_GET_TABLE_ROWS, this.guardBagInfo]))
      return

    const itemids = this._bagItems.items.map(item => item.asset_id)
    const dat = await resp.json()
    const items = dat.rows
      .map(item => ({
        key: item.account,
        value: { locked: item.locked, items: item.items.map(item => ({ asset_id: item })) }
      }))
      .reduce((a, b) => Object.assign(a, { [b.key]: b.value }), {})
    this._bagItems = items[this._account.account] || {
      items: [],
      locked: 0
    }
    const itemidsn = this._bagItems.items.map(item => item.asset_id)
    if (itemids.join() !== itemidsn.join()) {
      logger.debug('update bag', this._bagItems)
      this._bagUpdated = true
      this.fireReadyEvent()
    }
  }

  private updateMineStatus = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_GET_TABLE_ROWS, this.guardMineStatus]))
      return

    const dat = await resp.json()
    if (dat.rows[0].last_mine !== this._mineStatus.last_mine) {
      this._mineStatus = dat.rows[0]

      logger.debug('update mine status', this._mineStatus)
      this._mineStatusUpdated = true
      this.fireReadyEvent()
    }
  }

  private updateTransaction = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, AW_API_PUSH_TRANSACTION))
      return

    const dat = await resp.json()
    this._transaction = dat
    this._transactionOk = resp.ok()
    logger.debug('update trasaction', this._transaction)
    this._transactionUpdated = true
    this.fireReadyEvent()
  }

  private isDataReady(): boolean {
    // Check tools detail
    const toolsOk = this._bagItems.items.map((item): boolean => {
      const assets = this._assets.find(ast => ast.asset_id === item.asset_id)
      return assets ? true : false
    }).reduce((a, b) => (a && b), true)
    // Check land detail
    const land = this._assets.find(ast => ast.asset_id === this._mineStatus.current_land)
    const landOk = !!land

    return toolsOk && landOk
  }

  isReady(): boolean {
    if (!this._pageReady) return false
    if (!this._balanceUpdated) return false
    if (!this._bagUpdated) return false
    if (!this._assetsUpdated) return false
    if (!this._mineStatusUpdated) return false
    if (!this.isDataReady()) return false
    return true
  }

  private fireReadyEvent() {
    if (this.isReady() && this._readyEventFired === false) {
      this._readyEventFired = true

      this.determinStage()
    }
  }

  private updatePageStatus = () => {
    logger.debug('dom content loaded')
    this._pageReady = true
  }

  private async stepPrepare() {
    logger.log('🔧 Prepare...')
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
    page.on(PageEmittedEvents.DOMContentLoaded, this.updatePageStatus)
    page.on(PageEmittedEvents.Response, this.updateBalance)
    page.on(PageEmittedEvents.Response, this.updateAssetsInfo)
    page.on(PageEmittedEvents.Response, this.updateBagInfo)
    page.on(PageEmittedEvents.Response, this.updateMineStatus)
    page.on(PageEmittedEvents.Response, this.updateTransaction)
    page.reload({
      timeout: TIME_5_MINITE
    })
      // .then(() => {
      // })
      .catch(err => {
        logger.log('Page reload error: ')
        logger.log(err.message)

        // TODO: Which error shold be terminate proccess
        // Sometimes timeout will not break mining proccess

        // page.off(PageEmittedEvents.DOMContentLoaded, this.updatePageStatus)
        // page.off(PageEmittedEvents.Response, this.updateBanance)
        // page.off(PageEmittedEvents.Response, this.updateAssetsInfo)
        // page.off(PageEmittedEvents.Response, this.updateBagInfo)
        // page.off(PageEmittedEvents.Response, this.updateMineStatus)
        // page.off(PageEmittedEvents.Response, this.updateTransaction)

        // this.complete(TaskState.Canceled, err.message, null, getAwakeTime(TIME_MINITE))
      })

    // 1 minute for prepare, otherwise cancel task
    this.waitFor('Prepare for mine', async (): Promise<void | boolean> => {
      if (this._readyEventFired)
        return true
    }, 2 * TIME_MINITE)
  }

  private determinStage() {
    const lastMine = UTCtoGMT(this._mineStatus.last_mine)
    const cooldown = this.getCooldown()
    const nextMineTime = lastMine.getTime() + cooldown + random(5000, 1000)
    const currentTime = new Date().getTime()

    if (currentTime > nextMineTime) {
      this.nextStep(STEP_MINE)
    } else {
      const akt = getAwakeTime(nextMineTime - currentTime)
      logger.log(`🍸 Tools cooldown, next mine attempt at ${moment(akt).format(config.datetimeFormat)}`)
      this.complete(TaskState.Canceled, 'tools cooldown', null, akt)
    }
  }


  private async stepMine() {
    logger.log('🚂 Mining...')

    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
    await page.bringToFront()

    let clicked = 0
    const clickMine = async (): Promise<boolean | void> => {
      const btn = await page.$(CLS_BTN_MINE)
      if (!clicked && btn) {
        await btn.click({
          delay: random(2000, 1000)
        })
        logger.debug('Mine button clicked')
        clicked = new Date().getTime()
      }
      else if (clicked && !btn) {
        this.nextStep(STEP_CLAIM)
        return true
      }
      else if (clicked && btn) {
        const txt = await btn.evaluate(btn => btn.textContent)
        logger.debug('check if mine btn changed:', txt)
        if ((/^mine$/i).test(txt)) {
          const elapsed = new Date().getTime() - clicked
          if (elapsed > 15000) {
            // Retry click
            logger.debug('Retry click mine button')
            clicked = 0
          }
        } else {
          this.nextStep(STEP_CLAIM)
          return true
        }
      }
    }
    this.waitFor('Wait for mine button', clickMine, 3 * TIME_MINITE)
  }

  private async stepClaim() {
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)

    const doApprove = async (popup: Page) => {
      const clickApproveButton = async (): Promise<void | boolean> => {
        try {
          const btnLogin = await popup.$('.error-container button[type="submit"]')
          if (btnLogin) {
            // Reqeuir login, abort curren task
            popup.close()
            const msg = 'Session expried, login required.'
            logger.log(msg)
            const akt = getAwakeTime(30 * TIME_MINITE)
            this.complete(TaskState.Canceled, msg, null, akt)
            return true
          }

          const btnApprove = await popup.$(CLS_BTN_APPROVE)
          if (btnApprove) {
            await popup.click(CLS_BTN_APPROVE)
            return true
          }
        } catch (err) { }
      }
      // popup.once(PageEmittedEvents.DOMContentLoaded, () => {
      // })
      popup.once(PageEmittedEvents.Close, () => {
        this.nextStep(STEP_CONFIRM)
      })
      this.waitFor('Wait for approve', clickApproveButton, TIME_10_MINITE)
    }
    page.once(PageEmittedEvents.Popup, doApprove)

    const waitClaimButton = async (): Promise<void | boolean> => {
      try {
        const btn = await page.$(CLS_BTN_CLAIM)
        if (btn) {
          logger.log('🐝 Claiming...')
          this._balanceUpdated = false
          this._mineStatusUpdated = false
          await btn.click({
            delay: random(1600, 1000)
          })
          return true
        }
      } catch (err) { }
    }
    this.waitFor('Wait for Claim button', waitClaimButton, TIME_10_MINITE)
  }

  private async stepConfirm() {
    logger.log('📜 Confirming...')
    const confirmMining = async (): Promise<void | boolean> => {
      if (!this._transactionUpdated) return
      if (this._transactionOk && !this._mineStatusUpdated) return
      if (this._transactionOk && !this._balanceUpdated) return

      if (this._transactionOk) {
        const lastMineTime = UTCtoGMT(this._mineStatus.last_mine)
        const cooldown = this.getCooldown()
        const akt = getAwakeTime(lastMineTime.getTime() + cooldown - new Date().getTime())
        const rst = {
          nextAttemptAt: akt,
          total: this._balance,
          reward: this._balanceChanged,
        }
        logger.log(`💎 ${this._balanceChanged.toFixed(4)} TLM mined, current total ${this._balance.toFixed(4)} TLM.`)
        logger.log(`⏰ Next attempt at ${moment(akt).format(config.datetimeFormat)}`)
        this.complete(TaskState.Completed, 'success', rst, akt)
      } else {
        const message = this._transaction.error.details[0].message
        const lastMineTime = UTCtoGMT(this._mineStatus.last_mine)
        const delay = lastMineTime.getTime() + config.mining.outOfResourceDelay * 1000 - new Date().getTime()
        const akt = getAwakeTime(delay < TIME_HALF_HOUR ? TIME_HALF_HOUR : delay)
        logger.log(`❌ ${message}.`)
        logger.log(`⏰ Next attempt at ${moment(akt).format(config.datetimeFormat)}`)
        this.complete(TaskState.Completed, message, null, akt)
      }

      return true
    }
    this.waitFor('Wait for confirm', confirmMining, 0, () => {
      if (this._transactionOk) {
        logger.log('❓ Transaction seems ok, but balance and miner status not change.')
        logger.log('❓ tx:', this._transaction.transaction_id)
      } else {
        logger.log('Confirm mining status timeout, please check network.')
      }
      const akt = getAwakeTime(15 * TIME_MINITE)
      logger.log(`⏰ Next attempt at ${moment(akt).format(config.mining.datetimeFormat)}`)
      this.complete(TaskState.Timeout, 'Confirming timeout', null, akt)
    })
  }

  protected async cleanUp() {
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
    page.off(PageEmittedEvents.DOMContentLoaded, this.updatePageStatus)
    page.off(PageEmittedEvents.Response, this.updateBalance)
    page.off(PageEmittedEvents.Response, this.updateAssetsInfo)
    page.off(PageEmittedEvents.Response, this.updateBagInfo)
    page.off(PageEmittedEvents.Response, this.updateMineStatus)
    page.off(PageEmittedEvents.Response, this.updateTransaction)
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

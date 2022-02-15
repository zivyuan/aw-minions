import BaseTask, { TaskState } from "./BaseTask";
import { getAwakeTime, random } from "../utils/utils";
import Logger from "../Logger";
import { PAGE_ALIEN_WORLDS, AW_API_GET_TABLE_ROWS, AW_API_PUSH_TRANSACTION, TIME_5_MINITE, AW_API_ASSETS_INFO, TIME_MINITE, TIME_10_MINITE } from "../utils/constant";
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_MINING, IAccountInfo, IMiningData } from "../types";
import { IMiningDataProvider } from "../Minion";
import { HTTPResponse, Page, PageEmittedEvents } from "puppeteer";
import moment from "moment";
import { sleep } from 'sleep'
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
  private _mineStatus: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _transaction: any = null

  constructor() {
    super('Mining')

    this.registerStep(STEP_PREPARE, this.stepPrepare, true)
    this.registerStep(STEP_MINE, this.stepMine)
    this.registerStep(STEP_CLAIM, this.stepClaim)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)
  }

  private getCooldown(): number {
    const tools = ([]).concat(this._bagItems.items)
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
    }

    this._balanceUpdated = true
    this.fireReadyEvent()
  }

  private updateAssetsInfo = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_ASSETS_INFO, this.guardAssetsInfo]))
      return

    const dat = await resp.json()
    this._assets = this._assets.concat(dat.data.filter(item =>
      (!this._assets.find(_t => _t.asset_id === item.asset_id))
    ))

    // link to bag items
    this._bagItems.items = this._bagItems.items.map(item => {
      const cached = this._assets.find(ast => ast.asset_id === item.asset_id)
      return cached ? {
        ...item,
        ...cached
      } : item
    })
    this._assetsUpdated = true
    this.fireReadyEvent()
  }

  private updateBagInfo = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_GET_TABLE_ROWS, this.guardBagInfo]))
      return

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
    this._bagUpdated = true
    this.fireReadyEvent()
  }

  private updateMineStatus = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, [AW_API_GET_TABLE_ROWS, this.guardMineStatus]))
      return

    const dat = await resp.json()
    this._mineStatus = dat.rows[0]
    this._mineStatusUpdated = true
    this.fireReadyEvent()
  }

  private updateTransaction = async (resp: HTTPResponse) => {
    if (!await responseGuard(resp, AW_API_PUSH_TRANSACTION))
      return

    const dat = await resp.json()
    this._transaction = dat
    this._transactionUpdated = true
    this.fireReadyEvent()
  }

  private isDataReady(): boolean {
    const tools = this._bagItems.items.filter(tool => !!tool.data)
    const land = this._assets.find(ast => ast.asset_id === this._mineStatus.current_land)
    return (tools.length > 0) && (!!land)
  }

  isReady(): boolean {
    if (!this._pageReady) return false
    if (!this._balanceUpdated) return false
    if (!this._assetsUpdated) return false
    if (!this._bagUpdated) return false
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
      if (this.isReady())
        return true
    }, TIME_MINITE)
  }

  private determinStage() {
    const lastMine = UTCtoGMT(this._mineStatus.last_mine)

    // Calcalute cooldown time
    const cooldown = this.getCooldown()
    const nextMineTime = lastMine.getTime() + cooldown + random(5000, 1000)
    const currentTime = new Date().getTime()

    if (currentTime > nextMineTime) {
      this.nextStep(STEP_MINE)
    } else {
      const akt = getAwakeTime(nextMineTime - currentTime)
      logger.log(`☕ Tools cooldown, next mine attempt at ${moment(akt).format(config.datetimeFormat)}`)
      this.complete(TaskState.Canceled, 'tools cooldown', null, akt)
    }
  }


  private async stepMine() {
    logger.log('⛏ Mining...')

    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS)
    await page.bringToFront()

    await page.waitForSelector(CLS_BTN_MINE)
    await page.click(CLS_BTN_MINE)

    this._balanceUpdated = false
    this._mineStatusUpdated = false
    this.nextStep(STEP_CLAIM)
  }

  private async stepClaim() {
    logger.log('🐝 Claiming...')
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
            this.complete(TaskState.Canceled, msg, null, 30 * TIME_MINITE)
            return true
          }

          const btnApprove = await popup.$(CLS_BTN_APPROVE)
          if (btnApprove) {
            await popup.click(CLS_BTN_APPROVE)
            this.nextStep(STEP_CONFIRM)
            return true
          }
        } catch (err) { }
      }
      popup.once(PageEmittedEvents.DOMContentLoaded, () => {
        this.waitFor('Wait for approve', clickApproveButton, TIME_10_MINITE)
      })
    }
    page.once(PageEmittedEvents.Popup, doApprove)

    const waitClaimButton = async (): Promise<void | boolean> => {
      try {
        const btn = await page.$(CLS_BTN_CLAIM)
        if (btn) {
          await btn.click({
            delay: random(1600, 1000)
          })
          // Stop loop
          return true
        }
      } catch (err) { }
    }
    this.waitFor('Wait for Claim button', waitClaimButton, TIME_10_MINITE)
  }

  private async stepConfirm() {
    logger.log('🐝 Confirming...')
    const confirmMining = async (): Promise<void | boolean> => {
      if (!this._mineStatusUpdated) return
      if (!this._transactionUpdated) return
      if (!this._balanceUpdated) return

      if (this._transaction.code !== 200) {
        const message = this._transaction.error.details[0].message
        const akt = getAwakeTime(config.mining.outOfResourceDelay * 1000)
        logger.log(`❌ ${message}.`)
        logger.log(`⏰ Next attempt at ${moment(akt).format(config.datetimeFormat)}`)
        this.complete(TaskState.Completed, message, null, akt)
      } else {
        const lastMineTime = UTCtoGMT(this._mineStatus.last_mine)
        const cooldown = this.getCooldown()
        const akt = getAwakeTime(lastMineTime.getTime() + cooldown)
        const rst = {
          nextAttemptAt: akt,
          total: this._balance,
          reward: this._balanceChanged,
        }
        logger.log(`💎 ${this._balanceChanged} TLM mined, current total ${this._balance} TLM.`)
        logger.log(`⏰ Next attempt at ${moment(akt).format(config.datetimeFormat)}`)
        this.complete(TaskState.Completed, 'success', rst, akt)
      }

      return true
    }
    this.waitFor('Wait for confirm', confirmMining)
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

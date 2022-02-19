import moment from "moment";
import { HTTPResponse, PageEmittedEvents } from "puppeteer";
import DingBot from "../DingBot";
import Logger from "../Logger";
import { DATA_KEY_ACCOUNT_INFO, IAccountInfo } from "../types";
import {PAGE_ALIEN_WORLDS_TOOLS, TIME_10_MINITE, TIME_8_HOUR, TIME_DAY } from "../utils/constant";
import { UTCtoGMT } from "../utils/datetime";
import { responseGuard } from "../utils/pputils";
import { getAwakeTime, random } from "../utils/utils";
import BaseTask, { TaskState } from "./BaseTask"
import { sleep } from 'sleep'

export interface IReportResult {
  state: number
}


interface MineLog {
  account?: string,
  bounty: number,
  timestamp: Date,
  details?: []
}

const STEP_REPORT = 'report'
const STEP_LOAD_LOG = 'load-log'



let logger
export default class Report extends BaseTask<IReportResult> {
  constructor() {
    super('Reporter')

    if (!logger) {
      logger = new Logger(this.name)
    }

    this.registerStep(STEP_LOAD_LOG, this.stepLoadData, true);
    this.registerStep(STEP_REPORT, this.stepReport);
  }

  private _history: MineLog[] = []
  private _today: number
  private _day = 0
  private _maxDay = 5
  private _account: IAccountInfo

  private updateHistory = async (resp: HTTPResponse) => {
    if (!(await responseGuard(resp, 'https://api.alienworlds.io/v1/alienworlds/mines?miner=')))
      return

    const dat = await resp.json()
    const datestr = (await resp.url()).replace(/.*&from=([TZ\d-:.]+)&.*/i, '$1')
    logger.debug('parse date from url', datestr)
    const date = UTCtoGMT(datestr)
    const history = dat.results.map(item => ({
      timestamp: UTCtoGMT(item.block_timestamp),
      bounty: item.bounty / 1000
    }))
    const total = history.length === 0
      ? 0
      : history.reduce((a, b) => a + b.bounty, 0)
    this._history.push({
      timestamp: new Date(date),
      bounty: total,
      details: history,
    })
    logger.debug(`log update ${moment(date).format('YYYY-MM-DD')}: ${total} / ${history.length}.`)

    this.loadNextDay()
  }

  private async stepLoadData() {
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS_TOOLS, null)
    this._account = this.provider.getData<IAccountInfo>(DATA_KEY_ACCOUNT_INFO)
    this._today = new Date(moment().format('YYYY-MM-DD')).getTime()

    page.on(PageEmittedEvents.Response, this.updateHistory)
    this.loadNextDay()
  }

  private async loadNextDay() {
    if (this._day >= this._maxDay) {
      this.nextStep(STEP_REPORT)
      return
    }

    if (this._day !== 0) {
      const delay = random(45, 15)
      logger.debug(`Delay ${delay} seconds for next day...`)
      sleep(delay)
    }

    const date = moment(new Date(this._today - this._day * TIME_DAY)).format('YYYY-MM-DD')
    const url = `https://mining.alienworlds.tools/?account=${this._account.account}&date=${date}&skip=0`

    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS_TOOLS)

    logger.log('Load log for', date)
    logger.debug('Query log:', url)
    page.goto(url)
      .catch((err) => {
        // Task delay
        // page.off(PageEmittedEvents.Response, this.updateHistory)
        // logger.log('Mine log query failed. Retry after 5 minutes.')
        // logger.debug('Page open error:', err)
        // logger.debug(this._history)
        // const akt = getAwakeTime(TIME_10_MINITE)
        // this.complete(TaskState.Canceled, 'Log query failed.', null, akt)
      })
    this._day++
  }

  private async stepReport() {
    const page = await this.provider.getPage(PAGE_ALIEN_WORLDS_TOOLS)
    logger.log('Create mining report...')
    const report = this._history.map((item: MineLog, index) => {
      const label = index === 0 ? 'Today' : moment(item.timestamp).format('MM/DD')
      const record = `${label}:  ${item.bounty.toFixed(4)} / ${item.details.length}`
      logger.log(record)
      return record
    })
    page.off(PageEmittedEvents.Response, this.updateHistory)
    const content = `${this._account.username}\n(${this._account.account})\n${report.join('\n')} `
    DingBot.getInstance().text(content)

    const now = new Date()
    const start = new Date(moment(now).format('YYYY-MM-DD 00:00:00'))
    const next = start.getTime() + Math.ceil(now.getTime() / TIME_8_HOUR) * TIME_8_HOUR
    const akt = getAwakeTime(next - now.getTime())
    this.complete(TaskState.Completed, '', null, akt)
  }
}

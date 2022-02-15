/* eslint-disable @typescript-eslint/no-explicit-any */

import moment from "moment";
import fs from 'fs';
import { Browser, Page } from "puppeteer";
import config from "./config";
import Logger from "./Logger";
import { ITask, ITaskResult, TaskState } from "./tasks/BaseTask";
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_BROWSER, DATA_KEY_COOKIE, DATA_KEY_MINING, IAccountInfo, IBrowserConfig, IMinionData, PageEventHandleObject, TaskObject } from "./types";
import { randomUserAgent } from "./utils/useragent";
import { merge } from "merge-anything";

export interface IMinionReports {
  reports: {
    [report: string]: any
  }
}

interface ILockData {
  account: string
  message: string
  timestamp: number
}

export enum MiningState {
  Idle,
  Busy
}

export interface IMiningDataProvider {
  /**
   * Get a page with key
   *
   * @param key        Key of the page
   * @param handles    Event handles should be attached to page
   */
  getPage(key: string, handles?: PageEventHandleObject): Promise<Page>

  getData<T>(key: string, def?: any): T

  setData(key: string, data: any, save?: boolean): void

  loadData(): void

  saveData(): void
}

export interface IMinionConfig {
  enableCSS?: boolean
  enableFont?: boolean
  enableImage?: boolean
  //
  requestFilter?: string[]
}

let logger
export default class Minion implements IMiningDataProvider {
  private browser: Browser
  private config: IMinionConfig = {
    enableCSS: true,
    enableFont: false,
    enableImage: false,
    requestFilter: []
  }
  private _pagePool: Page[] = []
  private _taskPool: TaskObject[] = []
  private _pollingIndex = 0
  private _state: MiningState = MiningState.Idle
  private _pollingId = 0
  private _currentTask: ITask<any> = null
  private _data: IMinionData
  private _userAgent: string
  private accountInfo: IAccountInfo


  constructor(account: string, username?: string, password?: string) {
    if (!logger) {
      logger = new Logger('minion')
    }

    this._data = {
      [DATA_KEY_COOKIE]: [],
      [DATA_KEY_ACCOUNT_INFO]: {
        account: '',
        username: '',
        password: '',
        logined: false,
      },
      [DATA_KEY_MINING]: {
        total: 0,
        rewards: 0,
        stakeTotal: 0,
        stakeRewardTotal: 0,
        stakeRewardLast: 0,
        counter: 0,
      }
    }
    //
    const info = {
      account: String(account).trim(),
      username: String(username || '').trim(),
      password: String(password || '').trim(),
      logined: false
    }
    this.accountInfo = info

    this.loadData()
    this.setData(DATA_KEY_ACCOUNT_INFO, info)
    const browserInfo = this.getData<IBrowserConfig>(DATA_KEY_BROWSER)
    if (browserInfo.userAgent) {
      this._userAgent = browserInfo.userAgent
    } else {
      this._userAgent = randomUserAgent()
      this.setData(DATA_KEY_BROWSER, {
        userAgent: this._userAgent
      })
      this.saveData()
    }

    logger.debug('Useragent: ', this._userAgent)
  }

  get state(): MiningState {
    return this._state
  }

  async prepare(browser: Browser, conf?: IMinionConfig) {
    this.browser = browser

    const _conf = <IMinionConfig>merge(this.config, conf || {})
    _conf.requestFilter = ([
      conf.enableCSS ? null : 'stylesheet',
      conf.enableFont ? null : 'font',
      conf.enableImage ? null : 'image',
    ]).filter(item => !!item)
    this.config = _conf
  }

  /**
   *
   * @param task 任务类对象
   * @param life 任务执行次数, 0 为无限次
   * @param interactive 是否需要交互
   */
  addTask(task: any, interactive = true) {
    this._taskPool.push({
      Class: task,
      life: 0,
      awakeTime: 0,
      interactive
    })
    if (typeof task.initial === 'function') {
      task.initial(this)
    }
  }

  start() {
    this._schedulePolling()
  }

  stop() {
    clearTimeout(this._pollingId)
  }

  private _nextTaskTimer = 0
  private _polling() {
    if (this.state !== MiningState.Idle) {
      this._schedulePolling()
      return
    }

    if (this._taskPool.length === 0) {
      this._schedulePolling()
      return
    }

    const mark = new Date().getTime()
    if (mark < this._nextTaskTimer) {
      this._schedulePolling()
      return
    }

    const ts = new Date().getTime()
    const total = this._taskPool.length
    let pickedTask: TaskObject = null

    for (let i = 0; i < total; i++) {
      const idx = (this._pollingIndex + i) % total
      const task = this._taskPool[idx]
      if (task.awakeTime < ts && this._state === MiningState.Idle && this._currentTask === null) {
        pickedTask = task
        break;
      }
    }

    if (pickedTask && this._requestWindow(pickedTask)) {
      const task: ITask<any> = new (pickedTask.Class)()
      task.setProvider(this)
      if (task.prepare()) {
        logger.log(`Task #${task.no} ${task.name} start.`)
        task.start()
          .then((rst: ITaskResult<any>) => {
            if (rst.awakeTime) {
              pickedTask.awakeTime = rst.awakeTime
              pickedTask.awakeTimeStr = moment(rst.awakeTime).format('YYYY-MM-DD HH:mm:ss')
            }
            logger.log(`Task #${task.no} ${task.name} complete with state: ${TaskState[rst.state]}`)
          })
          .catch(err => {
            logger.log(`Task #${task.no} ${task.name} complete with error: ${err}`)
          })
          .finally(() => {
            let polling = 1
            if (task.shouldTerminate) {
              this._taskPool.splice(this._pollingIndex, 1)
              polling = 0
            }

            this._pollingIndex = (this._pollingIndex + polling) % this._taskPool.length

            this._state = MiningState.Idle
            this._currentTask.destroy()
            this._currentTask = null
            this._nextTaskTimer = new Date().getTime() + config.minion.taskInterval * 1000

            if (pickedTask.interactive) {
              this._releaseLock()
            }
          })
        this._currentTask = task
        this._state = MiningState.Busy
      } else {
        logger.log(`Task #${task.no} ${task.name} skiped because ${task.message}`)
        this._pollingIndex = (this._pollingIndex + 1) % this._taskPool.length
      }
    }

    //
    this._schedulePolling()
  }

  private _schedulePolling(): void {
    clearTimeout(this._pollingId)
    this._pollingId = setTimeout(() => {
      this._polling()
    }, 500)
  }

  private _lockFile = './cache/window-lock'
  private _createLock(msg = ''): void {
    const dat: ILockData = {
      account: this.accountInfo.account,
      message: msg,
      timestamp: new Date().getTime()
    }
    fs.writeFileSync(this._lockFile, JSON.stringify(dat))
  }

  private _releaseLock(): void {
    if (fs.existsSync(this._lockFile)) {
      fs.unlinkSync(this._lockFile)
    }
  }

  private _requestWindow(task: TaskObject) {
    let hasLock = fs.existsSync(this._lockFile)
    if (hasLock) {
      try {
        const lockData: ILockData = JSON.parse(fs.readFileSync(this._lockFile).toString())
        const elapse = (new Date().getTime()) - lockData.timestamp
        if (elapse > (config.minion.windowLockTimeout * 1000)) {
          throw new Error('Force release window lock!')
        }
      } catch (err) {
        // Force release lock if lock data is error
        this._releaseLock()
        hasLock = false
      }
    }
    if (task.interactive && hasLock) {
      return false
    } else {
      this._createLock()
      return true
    }
  }


  //
  // Implemenmts for IPageProvider
  //

  /**
   * Get a page with key
   *
   * @param key        Key of the page
   *                   string and regexp used to compare with page title or url
   * @param handles    Event handles should be attached to page
   * @returns Promise<Page>
   */
  async getPage(key: string, handles?: PageEventHandleObject): Promise<Page> {

    const createPage = async (): Promise<Page> => {
      if (!this._pagePool[key]) {
        const page = await this.browser.newPage()
        this._pagePool[key] = page
      }

      const page = this._pagePool[key]
      if (handles) {
        for (key in handles) {
          page.on(key, handles[key])
        }
      }

      await page.setRequestInterception(true);
      page.on('request', (interceptedRequest) => {
        if (interceptedRequest.isInterceptResolutionHandled()) return;
        // Cancel all images
        const filter = this.config.requestFilter
        if (filter.indexOf(interceptedRequest.resourceType()) > -1) {
          interceptedRequest.abort();
        } else {
          interceptedRequest.continue();
        }
      });

      return page
    }

    return new Promise((resolve) => {
      const page = createPage()
      resolve(page)
    })
  }

  private uniformKey(key: string): string {
    return key.replace(/[^\w]+/g, '_')
  }

  getData<T>(key: string, def = {}): T {
    let data = null
    key = this.uniformKey(key)
    if (this._data[key]) {
      data = JSON.parse(JSON.stringify(this._data[key]))
    }
    return <T>(data || def)
  }

  setData(key: string, data: any, save = false): void {
    key = this.uniformKey(key)
    this._data[key] = merge(this._data[key], data)

    if (save) {
      this.saveData()
    }
  }

  /**
   * Load saved data from disk cache
   */
  loadData(): void {
    const dataFile = this.getCacheFile()
    let theData
    if (fs.existsSync(dataFile)) {
      const content = fs.readFileSync(dataFile).toString().trim()
      try {
        theData = JSON.parse(content)
        // eslint-disable-next-line no-empty
      } catch (err) { }
    }
    this._data = Object.assign({}, this._data, theData)
  }
  /**
   * Save data to disk
   */
  saveData(): void {
    const dataFile = this.getCacheFile()
    const path = dataFile.replace(/[\w.-]+\.json$/, '')

    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, {
        recursive: true
      })
    }

    fs.writeFileSync(dataFile, JSON.stringify(this._data, null, 2))
  }

  private getCacheFile(): string {
    return `./cache/${this.accountInfo.account}.json`
  }
}

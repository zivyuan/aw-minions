/* eslint-disable @typescript-eslint/no-explicit-any */

import { Browser, Page } from "puppeteer";
import Logger from "./Logger";
import { ITask, ITaskResult, TaskState } from "./tasks/BaseTask";
import { DATA_ACCOUNT_INFO } from "./utils/constant";
import { randomUserAgent } from "./utils/useragent";

export interface IMinionReports {
  reports: {
    [report: string]: any
  }
}

export enum MiningState {
  Idle,
  Busy
}

type PageQueryFunc = (page: Page) => Promise<boolean>

export interface AccountInfo {
  account: string
  username: string
  password: string
}

interface TaskObject {
  Class: any
  // Set 0 to make task always running
  life: number
  awakeTime: number
}

export interface IMiningDataProvider {
  /**
   * Get a page with condition
   *
   * @param query       Condition to find page
   *                      - string    search page title or url with excatly
   *                      - regexp    RegExp expression
   *                      - function  custom defined compare mode
   *                    string and regexp used to compare with page title or url
   * @param urlOrWait   Value to determin what to do if no page found.
   *                      - string  a valid url string will get a new page with this url
   *                      - true    continue search until query matched
   *                      - other   create new blank page
   * @returns Promise<Page>
   */
  getPage(query: string | RegExp | PageQueryFunc, urlOrWait?: string | boolean): Promise<Page>

  getData<T>(key: string): T
}


const logger = new Logger()
export default class Minion implements IMiningDataProvider {
  private browser: Browser
  private _taskPool: TaskObject[] = []
  private _pollingIndex = 0
  private _state: MiningState = MiningState.Idle
  private _pollingId = 0
  private _currentTask: ITask<any> = null
  private _data: { [prop: string]: any } = {}
  private _userAgent: string

  constructor(account: string, username?: string, password?: string) {
    const info = {
      account: String(account).trim(),
      username: String(username || '').trim(),
      password: String(password || '').trim(),
    }
    this.setData(DATA_ACCOUNT_INFO, info)

    this._userAgent = randomUserAgent()

    logger.setScope('Minion')
    logger.log('use useragent: ', this._userAgent)
  }

  get state(): MiningState {
    return this._state
  }

  async prepare(browser: Browser) {
    this.browser = browser
  }

  addTask(task: any, life = 0) {
    this._taskPool.push({
      Class: task,
      life,
      awakeTime: 0
    })
  }

  start() {
    this._schedulePolling()
  }

  stop() {
    clearTimeout(this._pollingId)
  }

  private _polling() {
    if (this.state !== MiningState.Idle) {
      this._schedulePolling()
      return
    }

    if (this._taskPool.length === 0) {
      this._schedulePolling()
      return
    }

    const ts = new Date().getTime()
    const currentTask = this._taskPool[this._pollingIndex]
    if (currentTask.awakeTime < ts && this._state === MiningState.Idle && this._currentTask === null) {
      const task: ITask<any> = new (currentTask.Class)()
      task.setProvider(this)
      task.prepare()
      task.start()
        .then((rst: ITaskResult<any>) => {
          if (rst.awakeTime) {
            currentTask.awakeTime = rst.awakeTime
          }
          logger.log(`Task #${task.no} ${task.name} complete with state: ${TaskState[rst.state]}`)
        })
        .catch(err => {
          logger.log(`Task #${task.no} ${task.name} complete with error: ${err}`)
        })
        .finally(() => {
          let polling = 1
          if (currentTask.life > 0) {
            currentTask.life = currentTask.life - 1
            if (currentTask.life === 0) {
              this._taskPool.splice(this._pollingIndex, 1)
              polling = 0
            }
          }

          this._pollingIndex += polling
          if (this._pollingIndex >= this._taskPool.length) {
            this._pollingIndex = 0
          }

          this._state = MiningState.Idle
          this._currentTask.destroy()
          this._currentTask = null
        })
      this._currentTask = task
      this._state = MiningState.Busy
      logger.log(`Task #${task.no} ${task.name} started.`)
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


  //
  // Implemenmts for IPageProvider
  //

  /**
   * Get a page with condition
   *
   * @param query      A query string maybe a title, url or special method
   *                   string and regexp used to compare with page title or url
   * @param queryUrl   Set ture to compare query value with page url
   * @returns Promise<Page>
   */
  async getPage(query: string | RegExp | PageQueryFunc, urlOrWait?: string | boolean): Promise<Page> {
    return new Promise((resolve) => {
      const searchPage = async () => {
        const pages = await this.browser.pages()
        const blankPages: Page[] = []
        let page: Page
        let queryFunc: PageQueryFunc
        if (typeof query === 'function') {
          queryFunc = query

        } else if (query instanceof RegExp) {
          queryFunc = async (page: Page): Promise<boolean> => {
            const title = await page.title()
            const url = await page.evaluate(`document.location.href`)
            const rst = (<RegExp>query).test(title) || (<RegExp>query).test(url)
            return new Promise((resolve) => {
              resolve(rst)
            })
          }

        } else {
          queryFunc = async (page: Page): Promise<boolean> => {
            const title = await page.title()
            const url = await page.evaluate(`document.location.href`)
            const rst = (title.indexOf(query) > -1) || (url.indexOf(query) > -1)
            return new Promise((resolve) => {
              resolve(rst)
            })
          }
        }

        try {
          for (let i = 0; i < pages.length; i++) {
            const p = pages[i]
            const rst = await queryFunc(p)
            if (rst && !page) {
              page = pages[i]
            }
            //
            const url = await p.evaluate(`document.location.href`)
            const title = await p.title()
            if (url === 'about:blank' && title === '') {
              blankPages.push(p)
            }
          }
        } catch (err) {
          setTimeout(() => {
            searchPage()
          }, 500)
          return
        }

        if (!page) {
          if (urlOrWait === true) {
            // Continue search until find
            setTimeout(() => {
              searchPage()
            }, 500)
            return
          }
          urlOrWait = typeof urlOrWait === 'string' ? urlOrWait : ''

          if (blankPages.length) {
            page = blankPages.shift()
          } else {
            page = await this.browser.newPage()
          }
          page.setDefaultTimeout(0)
          page.setDefaultNavigationTimeout(0)
          if (urlOrWait.length) {
            await page.goto(urlOrWait)
          }
        }

        page.setUserAgent(this._userAgent)

        resolve(page)
      }

      searchPage()
    })
  }

  private uniformKey(key: string): string {
    return key.replace(/[^\w]+/g, '_')
  }

  getData<T>(key: string): T {
    key = this.uniformKey(key)
    const data = JSON.parse(JSON.stringify(this._data[key]))
    return <T>(data || {})
  }

  setData(key: string, data: any): void {
    key = this.uniformKey(key)
    data = JSON.parse(JSON.stringify(data))
    this._data[key] = data
  }
}

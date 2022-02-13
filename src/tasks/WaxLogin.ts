import { sleep } from "sleep"
import Logger from "../Logger"
import BaseTask, { TaskState } from "./BaseTask"
import { PAGE_WAX_WALLET_TESTER, PAGE_WAXWALLET as PAGE_WAX_WALLET, WAX_API_SESSION, URL_WAX_WALLET, URL_WAX_WALLET_LOGIN } from "../utils/constant"
import DingBot from "../DingBot"
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_COOKIE, IAccountInfo, CookieObject } from "../types"
import { PageEmittedEvents } from "puppeteer"

export interface IWaxLoginResult {
  account: string
  balance: number
}

// const STEP_CHECK_COOKIE_CACHE = 'check_cookie_cache'
const STEP_RESTORE_COOKIE = 'restore_cookie'
const STEP_FILL_FORM = 'login'
const STEP_SAVE_COOKIE = 'save_cookie'

const SEL_IPT_USERNAME = '.button-container input[name="userName"]'
const SEL_IPT_PASSWORD = '.button-container input[name="password"]'

const logger = new Logger()
export class WaxLogin extends BaseTask<IWaxLoginResult> {

  constructor() {
    super('Wax Login')

    this.registerStep(STEP_RESTORE_COOKIE, this.stepAutoLogin, true)
    this.registerStep(STEP_FILL_FORM, this.stepFillForm)
    this.registerStep(STEP_SAVE_COOKIE, this.stepSaveSession)

    logger.setScope(this.name)
  }

  private async stepAutoLogin() {
    const page = await this.provider.getPage(PAGE_WAX_WALLET)
    const title = await page.title()

    // Reload cookies after page loaded

    const handleDomLoaded = async () => {
      const url = await page.evaluate(() => document.location.href)

      if (url === URL_WAX_WALLET_LOGIN) {
        setTimeout(async () => {
          try {
            const ipt = await page.$(SEL_IPT_USERNAME)
            if (ipt) {
              unregisterEvents()
              this.nextStep(STEP_FILL_FORM)
            }
          } catch (err) { }
        }, 3000)

      } else if (url === URL_WAX_WALLET) {
        // Delay 3 seconds for page update
        sleep(3)
        unregisterEvents()
        this.nextStep(STEP_SAVE_COOKIE)
      }
    }
    // Handle errors
    const handleError = (err) => {
      unregisterEvents()
      this.complete(TaskState.Canceled, err.message, null, new Date().getTime() + 60 * 1000)
    }

    const unregisterEvents = () => {
      page.off(PageEmittedEvents.DOMContentLoaded, handleDomLoaded)
      page.off(PageEmittedEvents.Error, handleError)
      page.off(PageEmittedEvents.PageError, handleError)
    }
    //

    // Register events
    page.on(PageEmittedEvents.Error, handleError)
    page.on(PageEmittedEvents.PageError, handleError)
    if (!PAGE_WAX_WALLET_TESTER.test(title || '')) {
      const cookie = this.provider.getData<CookieObject[]>(DATA_KEY_COOKIE)
      if (cookie && cookie.length) {
        await page.setCookie(...cookie)
        sleep(1)
      }
    }

    page.on(PageEmittedEvents.DOMContentLoaded, handleDomLoaded)
    page.goto(URL_WAX_WALLET_LOGIN)
      .catch(err => {
        handleError(err)
      })
  }


  private async stepFillForm() {
    // Wax login page
    const page = await this.provider.getPage(PAGE_WAX_WALLET)

    // Chcek if account was baned
    const checkLoginStatus = async (resp) => {
      const respUrl = resp.url()
      const status = resp.status()
      if (respUrl.indexOf(WAX_API_SESSION) > -1) {
        if (resp.ok()) {
          // Login success
          sleep(3)
          unregisterEvents()
          this.nextStep(STEP_SAVE_COOKIE)

        } else {
          // Api error, try again later, max try 5 times
          let dat
          let resons: string[]
          try {
            dat = await resp.json()
            resons = dat.errors.map(item => `[${status}:${item.error_type}] ${item.message}`)
          } catch (err) {
            resons = ['Response parse error.', err.message]
          }

          if (status === 429) {
            // Too many times, delay task
            const awakeTime = new Date().getTime() + 35 * 60 * 1000
            this.complete(TaskState.Canceled, dat.errors[0].message, null, awakeTime)
          }
          logger.log('Login fail: ', resons)
        }
      }
    }

    const unregisterEvents = () => {
      page.off(PageEmittedEvents.Response, checkLoginStatus)
    }

    page.on(PageEmittedEvents.Response, checkLoginStatus)

    const btn_submit = '.button-container button'
    const { account, username, password } = this.provider.getData<IAccountInfo>(DATA_KEY_ACCOUNT_INFO)

    if (username) {
      logger.log(`Login with ${username}`)
    }
    await page.waitForSelector(SEL_IPT_USERNAME)
    sleep(1)
    if (username) {
      await page.type(SEL_IPT_USERNAME, username, {
        delay: 15,
      });
    }
    sleep(1)
    if (password) {
      await page.type(SEL_IPT_PASSWORD, password, {
        delay: 16,
      });
    }

    if (username && password) {
      sleep(1)
      await page.click(btn_submit)
    } else {
      logger.log('Username and password were required!')
      DingBot.getInstance().text(`[${account}] Please complete login form!`)
    }
  }

  private async stepSaveSession() {
    logger.log('Save session data ...')
    const page = await this.provider.getPage(PAGE_WAX_WALLET)
    await page.waitForSelector('.profile .avatar')

    const { account } = this.provider.getData<IAccountInfo>(DATA_KEY_ACCOUNT_INFO)
    const cookies = await page.cookies()
    this.provider.setData(DATA_KEY_COOKIE, cookies, true)
    this.provider.setData(DATA_KEY_ACCOUNT_INFO, {
      logined: true,
      password: '',
    })
    logger.log('Wax login success.')
    this._shouldTerminate = true
    this.complete(TaskState.Completed, '', {
      account,
      balance: 0
    })

  }

}

export default WaxLogin

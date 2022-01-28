import { sleep } from "sleep"
import Logger from "../Logger"
import BaseTask, { TaskState } from "./BaseTask"
import { restoreCookie, saveCookie } from "../utils/cookie"
import { AccountInfo } from "../Minion"
import { DATA_ACCOUNT_INFO, PAGE_FILTER_WAX as PAGE_TITLE_WAX_LOGIN, URL_WAX_WALLET_LOGIN } from "../utils/constant"
import DingBot from "../DingBot"

export interface IWaxLoginResult {
  account: string
  balance: number
}

// const STEP_CHECK_COOKIE_CACHE = 'check_cookie_cache'
const STEP_RESTORE_COOKIE = 'restore_cookie'
const STEP_AUTO_LOGIN = 'auto_login'
const STEP_LOGIN = 'login'
const STEP_SAVE_COOKIE = 'save_cookie'

const URL_WAX_DOMAIN = "all-access.wax.io"

const logger = new Logger()
export class WaxLogin extends BaseTask<IWaxLoginResult> {

  constructor() {
    super('Wax Login')

    this.registerStep(STEP_RESTORE_COOKIE, this.stepRestoreCookie, true)
    this.registerStep(STEP_AUTO_LOGIN, this.stepAutoLogin)
    this.registerStep(STEP_LOGIN, this.stepLogin)
    this.registerStep(STEP_SAVE_COOKIE, this.stepSaveCookie)

    logger.setScope(this.name)
  }

  private async stepRestoreCookie() {
    logger.log('Restore cookie...')
    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    const { account } = this.provider.getData<AccountInfo>(DATA_ACCOUNT_INFO)
    await restoreCookie(account, URL_WAX_DOMAIN, page)
    sleep(1)

    this.nextStep(STEP_AUTO_LOGIN)
  }

  private async stepAutoLogin() {
    let waitlogmark = 0
    const determinNextStep = async () => {
      let btn_submit = null
      let avatar = null

      try {
        // Auto login redirects may cause crash
        const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
        btn_submit = await page.$('.button-container button')
        avatar = await page.$('.profile .avatar')
      } catch (err) {
        logger.log('Context missing.........')
      }

      if (btn_submit) {
        logger.log('A~~~h~~~~~~~, I got caught! Wait! I have an ID!!!')
        this.nextStep(STEP_LOGIN)
      } else if (avatar) {
        this.nextStep(STEP_SAVE_COOKIE)
      } else {
        const tmark = new Date().getTime()
        if (waitlogmark < tmark) {
          logger.log('Waiting for auto login...')
          waitlogmark = tmark + 10 * 1000
        }
        setTimeout(() => {
          determinNextStep()
        }, 1000)
      }
    }

    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    logger.log('Try auto login, be quiet!')
    page.goto(URL_WAX_WALLET_LOGIN)
      .then(() => {
        determinNextStep()
      })
      .catch(err => {
        logger.log('Page load error:', err)
        setTimeout(() => {
          this.stepAutoLogin()
        }, 1000)
      })
  }

  private async stepLogin() {
    // Start fill form
    const iptUsernameCls = '.button-container input[name="userName"]'
    const iptPasswordCls = '.button-container input[name="password"]'
    // Wax login page
    const btn_submit = '.button-container button'
    const txt_error = '.button-container .error-container-login'

    const { account, username, password } = this.provider.getData<AccountInfo>(DATA_ACCOUNT_INFO)

    if (!username || !password) {
      logger.log(`Login with ..., ah! You bastard!`)
    } else {
      logger.log(`Login with ${username}...`)
    }

    let limitDelay = 0
    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    const sentryURL = 'https://o451638.ingest.sentry.io/api/5437824/store/?sentry_key=bcafca057f464617afa75b425997930e'
    page.on('response', (resp) => {
      if (resp.url().indexOf(sentryURL) === -1) {
        return
      }

      const status = resp.status()
      if (status === 200) {
        return
      }

      let delay = 5 * 60 * 1000
      if (status === 429) {
        const limited = resp.headers()['retry-after']
        delay = parseInt(limited) * 60 * 1000
        logger.log('Login was limited by server. Retry later ...')
      }

      clearTimeout(limitDelay)
      limitDelay = setTimeout(async () => {
        await page.click(btn_submit, {
          delay: 120
        })
      }, delay)
    })

    await page.waitForSelector(iptUsernameCls)
    sleep(2)
    await page.type(iptUsernameCls, username, {
      delay: 15,
    });
    sleep(1)
    await page.type(iptPasswordCls, password, {
      delay: 16,
    });
    sleep(2)

    if (username && password) {
      await page.click(btn_submit, {
        delay: 88
      })
    } else {
      logger.log('Masterrrrrr, give me the PASSWORD plz, I need work ...')
      DingBot.getInstance().text(`[${account}] Please login to Wax Wallet ...`)
    }

    let errorCheckTimer = 0
    let prevError = ''
    const checkLoginError = async () => {
      let errorMsg
      try {
        const avatar = await page.$('.profile .avatar')
        if (avatar) {
          throw new Error('login success')
        }

        errorMsg = await page.$$eval(txt_error + ' ul li', (li) => {
          return [...li].map(item => item.textContent)
        })

      } catch (err) {
        clearTimeout(errorCheckTimer)
        this.nextStep(STEP_SAVE_COOKIE)
        return
      }

      if (errorMsg && errorMsg.length) {
        const msg = errorMsg.join('\n')
        if (prevError !== msg) {
          // Uh-oh, you have too many failed login attempts. Check your username and password and try again after 30 minutes
          logger.log('Seriously? You make THIS SIMPLE STUPID  mistake ... ')
          logger.log(msg)
          logger.log('*** Please fix errors and click [LOGIN] button to continue ... ***')
          prevError = msg
          DingBot.getInstance().text(`Login error with username: ${username}! Please fix this manual. \n ${msg}`)
        }
      }
      errorCheckTimer = setTimeout(() => {
        checkLoginError()
      }, 500)
    }
    checkLoginError()
  }

  private async stepSaveCookie() {
    logger.log('Save cookie ...')
    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    await page.waitForSelector('.profile .avatar')

    const { account, username } = this.provider.getData<AccountInfo>(DATA_ACCOUNT_INFO)
    await saveCookie(account, URL_WAX_DOMAIN, page)

    if (username) {
      logger.log(`Love u dady, ahhhahahah~~~~~, work work`)
    } else {
      logger.log('Wax login success.')
    }
    this.complete(TaskState.Completed, '', {
      account,
      balance: 0
    })

  }

  // private async step2FA() {
  //   const ipt2FA = '.signin-2fa-container input'
  //   const btnSubmit = '.signin-2fa-container button[type="submit"]'
  // }

}

export default WaxLogin

import { sleep } from "sleep"
import config from "../config"
import Logger from "../Logger"
import BaseTask, { TaskState } from "./BaseTask"
import { restoreCookie, saveCookie } from "../utils/cookie"
import { disableTimeout } from "../utils/pputils"


export interface IAuthorizeResult {
  account: string
  username: string
  tlm: number
}

// const STEP_CHECK_COOKIE_CACHE = 'check_cookie_cache'
const STEP_RESTORE_COOKIE = 'restore_cookie'
const STEP_LOGIN = 'login'
const STEP_SAVE_COOKIE = 'save_cookie'

// const URL_WAX_CLOUD_WALLET_LOGIN = 'https://all-access.wax.io/cloud-wallet/login/'
const URL_WAX_DOMAIN = "all-access.wax.io"
const URL_WAX_WALLET_LOGIN = "https://all-access.wax.io/"


const logger = new Logger()
export class Authorize extends BaseTask<IAuthorizeResult> {
  private username = ''
  private password = ''

  constructor(username: string, password: string) {
    super('Task Authorize')

    this.username = String(username).trim()
    this.password = String(password).trim()

    this.registerStep(STEP_RESTORE_COOKIE, this.stepRestoreCookie, true)
    this.registerStep(STEP_LOGIN, this.stepLogin)
    this.registerStep(STEP_SAVE_COOKIE, this.stepSaveCookie)

    logger.setScope(this.name)
  }

  private async stepRestoreCookie() {
    const pages = await this.browser.pages()
    const page = pages[pages.length - 1]
    disableTimeout(page)
    await page.goto(URL_WAX_WALLET_LOGIN)
    await restoreCookie(this.username, URL_WAX_DOMAIN, page)
    await page.goto(URL_WAX_WALLET_LOGIN + '?_nc=' + (new Date().getTime()))

    const determinNextStep = async () => {
      const pages = await this.browser.pages()
      const page = pages[pages.length - 1]
      const btn_submit =  await page.$('.button-container button')
      const avatar = await page.$('.profile .avatar')
      if (btn_submit) {
        this.nextStep(STEP_LOGIN)
      } else if (avatar) {
        this.nextStep(STEP_SAVE_COOKIE)
      } else {
        setTimeout(() => {
          determinNextStep()
        }, 2000)
      }
    }

    determinNextStep()
  }

  private async stepLogin() {
    // Start fill form
    const iptUsernameCls = '.button-container input[name="userName"]'
    const iptPasswordCls = '.button-container input[name="password"]'
    // Wax login page
    const btn_submit = '.button-container button'
    const txt_error = '.button-container .error-container-login'

    sleep(2)
    logger.log('type username: ', this.username)
    await this.page.type(iptUsernameCls, this.username, {
      delay: 15,
    });
    sleep(1)
    logger.log('type password: ', this.password)
    await this.page.type(iptPasswordCls, this.password, {
      delay: 15,
    });
    sleep(1)
    await this.page.click(btn_submit, {
      delay: 120
    })
    sleep(2)

    let errorCheckTimer = 0
    const checkLoginError = async () => {
      let errorMsg
      try {
        const avatar = await this.page.$('.profile .avatar')
        if (avatar) {
          throw new Error('login success')
        }

        errorMsg = await this.page.$$eval(txt_error + ' ul li', (li) => {
          return [...li].map(item => item.textContent)
        })

      } catch (err) {
        clearTimeout(errorCheckTimer)
        this.nextStep(STEP_SAVE_COOKIE)
        return
      }

      if (errorMsg && errorMsg.length) {
        logger.log('Login error:', errorMsg)
        this.completeWithError(errorMsg.join('\n'))
      } else {
        const elapse = this.phaseElapseTime
        if (elapse > config.taskPhaseTimeout) {
          this.completeWithError('Task overtime!')
          return
        }
        errorCheckTimer = setTimeout(() => {
          checkLoginError()
        }, config.tickInterval)
      }
    }

    checkLoginError()
  }

  private async stepSaveCookie() {
    const searchAvart = async () => {
      const pages = await this.browser.pages()
      for (let i = pages.length - 1; i > 0; i--) {
        const page = pages[i]
        const avatar = await page.$('.profile .avatar')
        if (avatar) {
          await saveCookie(this.username, URL_WAX_DOMAIN, page)
          sleep(1)

          logger.log('authorize pass')

          this.complete(TaskState.Completed, '', {
            username: '',
            account: '',
            tlm: 0
          })
          return;
        }
      }

      setTimeout(() => {
        searchAvart()
      }, 5000)
    }

    searchAvart()
  }
}


export default Authorize

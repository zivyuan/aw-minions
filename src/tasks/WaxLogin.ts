import { sleep } from "sleep"
import config from "../config"
import Logger from "../Logger"
import BaseTask, { TaskState } from "./BaseTask"
import { restoreCookie, saveCookie } from "../utils/cookie"
import { AccountInfo } from "../Minion"
import { DATA_ACCOUNT_INFO, PAGE_TITLE_WAX as PAGE_TITLE_WAX_LOGIN, URL_WAX_WALLET_LOGIN } from "../utils/constant"

export interface IWaxLoginResult {
  account: string
  username: string
  tlm: number
}

// const STEP_CHECK_COOKIE_CACHE = 'check_cookie_cache'
const STEP_RESTORE_COOKIE = 'restore_cookie'
const STEP_LOGIN = 'login'
const STEP_SAVE_COOKIE = 'save_cookie'

const URL_WAX_DOMAIN = "all-access.wax.io"

const logger = new Logger()
export class WaxLogin extends BaseTask<IWaxLoginResult> {

  constructor() {
    super('Task Authorize')

    this.registerStep(STEP_RESTORE_COOKIE, this.stepRestoreCookie, true)
    this.registerStep(STEP_LOGIN, this.stepLogin)
    this.registerStep(STEP_SAVE_COOKIE, this.stepSaveCookie)

    logger.setScope(this.name)
  }

  private async stepRestoreCookie() {
    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    const { username } = this.provider.getData<AccountInfo>(DATA_ACCOUNT_INFO)
    logger.log('restore cookie...')
    await restoreCookie(username, URL_WAX_DOMAIN, page)
    sleep(1)
    logger.log('Open wax wallet dashboard...')

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
        this.nextStep(STEP_LOGIN)
      } else if (avatar) {
        this.nextStep(STEP_SAVE_COOKIE)
      } else {
        logger.log('Waiting for auto login...')
        setTimeout(() => {
          determinNextStep()
        }, 1000)
      }
    }

    page.goto(URL_WAX_WALLET_LOGIN)
      .then(rst => {
        console.log('goto next step', rst)
        // Set a delay after page loaded to avoid page redirect error
        sleep(5)
        determinNextStep()
      })
      .catch(err => {
        logger.log('page load overtime', err)
      })
  }

  private async stepLogin() {
    // Start fill form
    const iptUsernameCls = '.button-container input[name="userName"]'
    const iptPasswordCls = '.button-container input[name="password"]'
    // Wax login page
    const btn_submit = '.button-container button'
    const txt_error = '.button-container .error-container-login'

    const { username, password } = this.provider.getData<AccountInfo>(DATA_ACCOUNT_INFO)

    let limitDelay = 0
    sleep(2)
    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    page.on('response', (resp) => {
      if (resp.url().indexOf('https://o451638.ingest.sentry.io/api/5437824/store/?sentry_key=bcafca057f464617afa75b425997930e') === 0) {
        console.log('resp: ', resp)
        if (resp.status() === 429) {
          const limited = resp.headers()['retry-after']
          logger.log('Request limited by server. Retry after ' + limited + ' minute.')
          clearTimeout(limitDelay)
          limitDelay = setTimeout(async () => {
            await page.click(btn_submit, {
              delay: 120
            })
          }, parseInt(limited) * 60 * 1000)
        }
      }
    })
    logger.log('type username: ', username)
    await page.type(iptUsernameCls, username, {
      delay: 15,
    });
    sleep(1)
    logger.log('type password: ', password)
    await page.type(iptPasswordCls, password, {
      delay: 15,
    });
    sleep(2)
    await page.click(btn_submit, {
      delay: 120
    })


    let errorCheckTimer = 0
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
    const page = await this.provider.getPage(PAGE_TITLE_WAX_LOGIN)
    await page.waitForSelector('.profile .avatar')

    const { username } = this.provider.getData<AccountInfo>(DATA_ACCOUNT_INFO)
    await saveCookie(username, URL_WAX_DOMAIN, page)

    logger.log('Wax login success')
    this.complete(TaskState.Completed, '', {
      username: username,
      account: '',
      tlm: 0
    })

  }

  // private async step2FA() {
  //   const ipt2FA = '.signin-2fa-container input'
  //   const btnSubmit = '.signin-2fa-container button[type="submit"]'
  // }

}

export default WaxLogin

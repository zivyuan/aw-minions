import BaseTask, { TaskState } from "../../Task"
import { sleep } from 'sleep'
import config from '../../config'
import { Page } from "puppeteer"
import Logger from "../../Logger"

interface LoginInfo {
  username: string
  password: string
}

const STEP_LOGIN = 'login'
const STEP_FILL_FORM = 'fill-form'
const STEP_CONFIRM = 'confirm'

// Game home page
const CLS_AVATAR = '.css-1i7t220 .chakra-avatar'
// Login page
const CLS_BTN_LOGIN = '.css-yfg7h4 .css-t8p16t'
const CLS_SPINNER = '.css-yfg7h4 .css-t8p16t .chakra-spinner'
// Wax login page
const CLS_BTN_SUBMIT = '.button-container button'
const CLS_ERROR_CONTAINER = '.button-container .error-container-login'

const logger = new Logger()
export class Login extends BaseTask {

  // private _startTime = 0
  private loginInfo: LoginInfo

  constructor(loginInfo: LoginInfo) {
    super('Login Task')

    this.loginInfo = loginInfo

    this.registerStep(STEP_LOGIN, this.stepLogin, true)
    this.registerStep(STEP_FILL_FORM, this.stepFillForm)
    this.registerStep(STEP_CONFIRM, this.stepConfirm)

    logger.setScope('Login Task')
  }

  protected async tick(name: string) {
    // const elapse = this.phaseElapseTime
    const avatar = await this.page.$$(CLS_AVATAR)
    if (avatar.length) {
      // Auto login success
      this.success(TaskState.Completed, 'auto login')
      return
    }
    // if (elapse > config.taskPhaseTimeout) {
    // }

    super.tick(name)
  }

  // Step 1: find button
  private async stepLogin() {
    const loginBtn = await this.page.$$(CLS_BTN_LOGIN)
    const spinner = await this.page.$$(CLS_SPINNER)

    if (spinner.length) {
      // Auto load mode, just wait
      this.tick(STEP_LOGIN)

    } else if (loginBtn.length) {
      // wait for page loading
      logger.log('click on login button')
      await this.page.click(CLS_BTN_LOGIN, {
        delay: Math.floor(Math.random() * 50)
      })

      this.nextStep(STEP_FILL_FORM)
    } else {
      // Check if auto login success
      const logined = await this.page.$$(CLS_AVATAR)

      if (logined.length) {
        // auto login success
        this.success(TaskState.Completed)
      } else {
        this.tick(STEP_LOGIN)
      }
    }
  }

  // Step 2: fill form
  private async stepFillForm() {
    const btnLoginCls = CLS_BTN_SUBMIT
    // Get last opened window
    const pages = await this.browser.pages()
    let loginPage: Page = null
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const btnLogin = await page.$$(btnLoginCls)
      if (btnLogin.length) {
        loginPage = page
        break;
      }
    }

    if (!loginPage) {
      this.tick(STEP_FILL_FORM)
      return
    }

    let errorCheckTimer = 0
    const checkLoginError = async () => {
      if (loginPage.isClosed()) {
        return
      }

      const errContainerCls = CLS_ERROR_CONTAINER
      const errorMsg = await loginPage.$$eval(errContainerCls + ' ul li', (li) => {
        return [...li].map(item => item.textContent)
      })
      if (errorMsg && errorMsg.length) {
        logger.log('Login error:', errorMsg)
        this.error(errorMsg.join('\n'))
      } else {
        const elapse = this.phaseElapseTime
        if (elapse > config.taskPhaseTimeout) {
          this.error('Task overtime!')
          return
        }
        errorCheckTimer = setTimeout(() => {
          checkLoginError()
        }, config.tickInterval) as unknown as number
      }
    }

    loginPage.on('close', () => {
      clearTimeout(errorCheckTimer)
      this.nextStep(STEP_CONFIRM)
    });

    const iptUsernameCls = '.button-container input[name="userName"]'
    const iptPasswordCls = '.button-container input[name="password"]'


    sleep(2)
    logger.log('fill form ...')
    await loginPage.type(iptUsernameCls, this.loginInfo.username, {
      delay: 15,
    });
    sleep(1)
    await loginPage.type(iptPasswordCls, this.loginInfo.password, {
      delay: 15,
    });
    sleep(1)
    await loginPage.click(btnLoginCls, {
      delay: 120
    })
    sleep(2)


    this.updatePhase('wait-login-verfiy')
    checkLoginError()
  }

  // Step 3: confirm login state
  //
  private async stepConfirm() {
    const loginBtn = await this.page.$$(CLS_BTN_LOGIN)
    const spinner = await this.page.$$(CLS_SPINNER)
    const isWaiting = !!(spinner.length && loginBtn.length)

    if (isWaiting) {
      if (this.phaseElapseTime > config.taskPhaseTimeout) {
        this.error('Login timeout.')
      } else {
        this.tick(STEP_CONFIRM)
      }

    } else {
      // TODO: 需要邮件授权码的情况!
      this.success(TaskState.Completed, 'login success')
    }
  }
}


export default Login

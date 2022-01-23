import BaseTask, { TaskState } from "../../Task"
import { sleep } from 'sleep'
import config from '../../config'
import { random } from "../../utils/utils"
import { Page } from "puppeteer"

interface LoginInfo {
  username: string
  password: string
}

export class Login extends BaseTask {

  // private _startTime = 0
  private loginInfo: LoginInfo

  constructor(loginInfo: LoginInfo) {
    super('Login')

    this.loginInfo = loginInfo
  }

  protected nextStep() {
    // this._startTime = new Date().getTime()
    this.searchLoginButton();
  }

  // Step 1: find button
  private async searchLoginButton() {
    const btnClass = '.css-t8p16t'
    const spinnerClass = `${btnClass} .chakra-spinner`
    let spinner
    let loginBtn

    try {
      spinner = await this.page.$$(spinnerClass)
      loginBtn = await this.page.$$(btnClass)
    } catch (err) {
      // Dom not ready, Wait next tick
      setTimeout(() => {
        this.searchLoginButton()
      }, config.tickInterval)
      return
    }

    const isWaiting = !!(spinner.length && loginBtn.length)

    if (isWaiting) {
      // Auto load mode, just wait

      // Check if auto login success
      const logined = await this.page.$$('.auto login success mark!')

      if (logined.length) {
        // auto login success
        this._state = TaskState.Completed
        this._resolve(this.state)
      } else {
        console.log('waiting auto load...')
        // continue wait
        setTimeout(() => {
          this.searchLoginButton()
        }, config.tickInterval)
      }

    } else {
      // request password
      console.log('click on login button')
      await this.page.click(btnClass, {
        delay: Math.floor(Math.random() * 50)
      })
      // wait for page loading
      sleep(3)
      this.fillLoginForm()
    }
  }

  private _searchCount = 0

  // Step 2: fill form
  private async fillLoginForm() {
    const btnLoginCls = '.button-container button'
    console.log('find form: ')
    // Get last opened window
    const pages = await this.browser.pages()
    let loginPage: Page = null

    this._searchCount ++

    for(let i = 0; i < pages.length; i ++) {
      const page = pages[i]
      const btnLogin = await page.$$(btnLoginCls)
      await page.evaluate(
        `document.title = '🟢 S${this._searchCount } ${btnLogin.length} ...'`
      );
      if (btnLogin.length) {
        loginPage = page
        break;
      }
    }

    if (!loginPage) {
      setTimeout(() => {
        this.fillLoginForm()
      }, config.tickInterval)
      return
    }

    let errorCheckTimer = 0
    const checkLoginError = async () => {
      const errContainerCls = '.button-container .error-container-login'
      const errorMsg = await loginPage.$$eval(errContainerCls + ' ul li', (li) => {
        return [...li].map(item => item.textContent)
      })
      if (errorMsg && errorMsg.length) {
        console.log('error found!', errorMsg)
        this.error( errorMsg.join('\n') )
      } else {
        console.log('check login error...')
        const elapse = this.phaseElapseTime
        if (elapse > config.taskPhaseOvertime) {
          this.error('Task overtime! Task phase: check-login-error.')
          return
        }
        errorCheckTimer = setTimeout(() => {
          checkLoginError()
        }, config.tickInterval) as unknown as number
      }
    }

    loginPage.on('close', () => {
      clearTimeout(errorCheckTimer)
      this.confirmLoginState()
    });

    const iptUsernameCls = '.button-container input[name="userName"]'
    const iptPasswordCls = '.button-container input[name="password"]'


    sleep(2)
    console.log('fill username: ', this.loginInfo.username)
    await loginPage.type(iptUsernameCls, this.loginInfo.username, {
      delay: 15,
    });
    sleep(1)
    console.log('fill username: ', this.loginInfo.password)
    await loginPage.type(iptPasswordCls, this.loginInfo.password, {
      delay: 15,
    });
    sleep(1)
    await loginPage.click(btnLoginCls, {
      delay: 120
    })
    sleep(2)


    this.updatePhase('check-login-error')
    checkLoginError()
  }

  // Step 3: confirm login state
  //
  private confirmLoginState() {
    console.log('confirm login state!')
  }
}


export default Login

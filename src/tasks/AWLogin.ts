import BaseTask, { TaskState } from "./BaseTask";
import {sleep} from 'sleep'
import Logger from "../Logger";

export interface IAWLoginResult {
  account: string
  tlm: number
}

const logger = new Logger()
export default class AWLogin extends BaseTask<IAWLoginResult> {
  constructor() {
    super('AWLogin')

    this.registerStep('login', this.stepLogin, true)
    this.registerStep('check-login', this.stepCheckLogin)

    logger.setScope(this.name)
  }

  private async stepLogin() {
    const clickLogin = async () => {
      const btn = await this.page.$('.css-yfg7h4 .css-t8p16t')
      if (btn) {
        await this.page.click('.css-yfg7h4 .css-t8p16t', {
          delay: 80
        })
        sleep(2)
        this.nextStep('check-login')
      } else {
        setTimeout(() => {
          clickLogin()
        }, 2000)
      }
    }
    clickLogin()
  }

  private async stepCheckLogin() {
    const loop = async () => {
      const pages = await this.browser.pages()
      for(let i = pages.length - 1; i > 0; i--) {
        const page = pages[i];
        const avatar = await page.$('.css-1i7t220 .chakra-avatar')
        if (avatar) {
          sleep(1)
          logger.log('AW login success ')
          this.complete(TaskState.Completed)
          return
        }
      }
      setTimeout(() => {
        loop()
      }, 2000)
    }
    loop()
  }
}

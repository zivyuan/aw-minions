import BaseTask, { TaskState } from "./BaseTask";
import {sleep} from 'sleep'
import Logger from "../Logger";
import { PAGE_TITLE_ALIEN_WORLDS, URL_ALIEN_WORLDS } from "../utils/constant";

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
    const page = await this.provider.getPage(PAGE_TITLE_ALIEN_WORLDS, URL_ALIEN_WORLDS)
    await page.waitForSelector('.css-yfg7h4 .css-t8p16t')
    await page.click('.css-yfg7h4 .css-t8p16t', {
      delay: 80
    })
    sleep(2)
    this.nextStep('check-login')
  }

  private async stepCheckLogin() {
    const loop = async () => {
      const page = await this.provider.getPage(PAGE_TITLE_ALIEN_WORLDS)
      const avatar = await page.$('.css-1i7t220 .chakra-avatar')
      if (avatar) {
        sleep(1)
        logger.log('AW login success ')
        this.complete(TaskState.Completed)
        return
      }
      setTimeout(() => {
        loop()
      }, 2000)
    }
    loop()
  }
}

import moment from "moment";
import Logger from "../Logger";
import { PAGE_FILTER_WAX, URL_WAX_WALLET_STAKING } from "../utils/constant";
import BaseTask, { TaskState } from "./BaseTask";

export interface IStackRewardsResult {
  claimed: number
  balance: number
  staked: number
}

const logger = new Logger('Claim Stake')

export default class ClaimStakeRewards extends BaseTask<IStackRewardsResult> {
  constructor() {
    super('ClaimRewards')

    this.registerStep('claim', this.stepClaim, true)
  }

  private async stepClaim() {
    logger.log('Search for claiming ...')
    const page = await this.provider.getPage(PAGE_FILTER_WAX, URL_WAX_WALLET_STAKING)
    const url = await page.evaluate(`document.location.href`)
    if (url.indexOf(URL_WAX_WALLET_STAKING) > -1) {
      await page.reload()
    } else {
      await page.goto(URL_WAX_WALLET_STAKING)
    }

    const selBtnStaking = '.stake-card:nth-child(2) .button-tertiary'
    const selNavBtnStaking = '.navbar-left button:nth-child(4)'
    const selStakedWAXP = '.stake-card:nth-child(1) .__react_component_tooltip+div'

    await page.waitForSelector(selNavBtnStaking)
    await page.click(selNavBtnStaking)

    await page.waitForSelector(selBtnStaking)
    const btns = await page.$$(selBtnStaking)
    const btnLabels = await page.$$eval(selBtnStaking, items => items.map(it => it.textContent))
    let staked = parseFloat((await page.$eval(selStakedWAXP, item => item.textContent)).trim())
    staked = Math.round(staked * 10000000) / 10000000

    const count = /^\d{2}:\d{2}:\d{2}$/
    let claimAmount = parseFloat(btnLabels[1])
    claimAmount = isNaN(claimAmount) ? 0: claimAmount
    claimAmount = Math.round(claimAmount * 10000000) / 10000000
    let balance = parseFloat(await page.$eval('div[data-tip]', item => item.textContent))
    let awakeTime = new Date().getTime() + 24 * 60 * 60 * 1000
    if (claimAmount === 0) {
      // Nothing to do
      logger.log('No rewards found. You should stake some WAXP.')
      logger.log('Sigh~~~~(Head down, slowly walk away...)')
      awakeTime = new Date().getTime() + 60 * 60 * 1000

    } else if (count.test(btnLabels[2].trim())) {
      // Count down
      const countDown = btnLabels[2].split(':')
          .map((item, idx) => parseInt(item) * ([3600, 60, 1][idx]))
          .reduce((a, b) => a + b) * 1000
      awakeTime = new Date().getTime() + countDown + 30000
      logger.log(`Rewards not ready, claim will be available at ${moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')}`)
      logger.log('Sigh~~, 1, 2, 3, 40, 500, 6000 ... AH~~~~~~~~~~~~')

    } else {
      // claim button
      await btns[2].click()

      balance += claimAmount
      awakeTime += 30000
      logger.log(`${claimAmount} WAXP claimed, current total: ${balance} WAXP`)
      logger.log(`Next claim is after 24 hours at ${moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')}`)
      logger.log('Ahahahah~~~~~~~, banana banana banana banana ')

    }

    this.complete(TaskState.Completed, '', {
      claimed: claimAmount,
      balance: balance,
      staked: staked
    }, awakeTime)
  }
}

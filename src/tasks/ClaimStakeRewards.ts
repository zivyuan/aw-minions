import moment from "moment";
import Logger from "../Logger";
import { PAGE_FILTER_SIGN, PAGE_WAX_WALLET_TESTER, URL_WAX_WALLET_STAKING } from "../utils/constant";
import BaseTask, { TaskState } from "./BaseTask";
import { sleep } from 'sleep'
import { random } from "../utils/utils";
import { DATA_KEY_MINING, IMiningData } from "../types";

const CLS_BTN_APPROVE = '.authorize-transaction-container .react-ripples button'
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
    const selBtnStaking = '.stake-card:nth-child(2) .button-tertiary'
    const selStakedWAXP = '.stake-card:nth-child(1) .__react_component_tooltip+div'

    logger.log('Search for claiming ...')
    const page = await this.provider.getPage(PAGE_WAX_WALLET_TESTER, URL_WAX_WALLET_STAKING)
    // await page.bringToFront()
    const url = await page.evaluate(`document.location.href`)

    if (url.indexOf(URL_WAX_WALLET_STAKING) > -1) {
      await page.reload()
    } else {
      await page.goto(URL_WAX_WALLET_STAKING)
    }

    // Wait for page ajax update
    sleep(3)

    let staked = parseFloat((await page.$eval(selStakedWAXP, item => item.textContent)).trim())
    staked = Math.round(staked * 10000000) / 10000000
    let balance = parseFloat(await page.$eval('div[data-tip]', item => item.textContent))

    if (staked === 0) {
      const awakeTime = new Date().getTime() + 60 * 60 * 1000
      const msg = 'You need stake some WAX tokens and vote for a guilds to earn your WAX rewards.'
      logger.log(msg)
      this.complete(TaskState.Completed, `${msg}. I'll check it after 1 hour.`, {
        staked,
        claimed: 0,
        balance: balance
      }, awakeTime)
      return
    }

    sleep(3)

    await page.waitForSelector(selBtnStaking)
    const btns = await page.$$(selBtnStaking)
    const btnLabels = await page.$$eval(selBtnStaking, items => items.map(it => it.textContent))

    const count = /^\d{2}:\d{2}:\d{2}$/
    let claimAmount = parseFloat(btnLabels[1])
    claimAmount = isNaN(claimAmount) ? 0 : claimAmount
    claimAmount = Math.round(claimAmount * 10000000) / 10000000
    let awakeTime = new Date().getTime() + 24 * 60 * 60 * 1000
    if (claimAmount === 0) {
      // Nothing to do
      logger.log('No rewards found. You should stake some WAXP.')
      awakeTime = new Date().getTime() + 60 * 60 * 1000

    } else if (count.test(btnLabels[2].trim())) {
      // Count down
      const countDown = btnLabels[2].split(':')
        .map((item, idx) => parseInt(item) * ([3600, 60, 1][idx]))
        .reduce((a, b) => a + b) * 1000
      awakeTime = new Date().getTime() + countDown + 30000
      logger.log(`Rewards not ready, claim will be available at ${moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')}`)

    } else {
      // claim button
      await btns[2].click()
      logger.log('Approve claim...')
      const approvePage = await this.provider.getPage(PAGE_FILTER_SIGN, true)

      await approvePage.waitForSelector(CLS_BTN_APPROVE, { timeout: 5 * 60 * 1000 })
      await approvePage.click(CLS_BTN_APPROVE, {
        delay: 500 + random(2000)
      })
      // TODO: Click Approve button

      balance += claimAmount
      awakeTime += 30000
      logger.log(`${claimAmount} WAXP claimed, current total: ${balance} WAXP`)
      logger.log(`Next claim is after 24 hours at ${moment(awakeTime).format('YYYY-MM-DD HH:mm:ss')}`)
    }

    this.complete(TaskState.Completed, '', {
      claimed: claimAmount,
      balance: balance,
      staked: staked
    }, awakeTime)

    const conf = this.provider.getData<IMiningData>(DATA_KEY_MINING)
    conf.stakeTotal = staked
    this.provider.setData(DATA_KEY_MINING, conf)
    this.provider.saveData()

    page.reload()
  }
}

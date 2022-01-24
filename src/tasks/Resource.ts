import BaseTask from "./BaseTask";

const URL_BASE = 'https://wax.bloks.io/account/'

const STEP_QUERY_INFO = 'query_account_info'

export interface IAccountResources {
  wax: number
  cpu: number
  cpuUsed: number
  ram: number
  ramUsed: number
  net: number
  netUsed: number
}

export class ChainResource extends BaseTask {

  constructor() {
    super('QueryAccountInfo')

    this.registerStep(STEP_QUERY_INFO, this.queryResource, true)
  }
  private async queryResource() {
    const account = await this.page.$eval('.css-1i7t220 .css-eku06n .chakra-text', item => item.textContent)
    const page = await this.browser.newPage()
    await page.goto(`${URL_BASE}/${account}`)
    const res = await page.$$eval('.unstackable .progress .label', labels => labels.map(item => item.textContent))
    const resource: IAccountResources = {
      wax: 0,
      cpu: 0,
      cpuUsed: 0,
      ram: 0,
      ramUsed: 0,
      net: 0,
      netUsed: 0,
    }
    // 'RAM used - 3.74 KB / 3.74 KB', 'CPU used - 1.33 ms / 0 µs', 'NET used - 265 Bytes / 0 Bytes'
    const reg = /(ram|cpu|net) used - ([\d.]+ [\wµ]+) \/ ([\d.]+ [\wµ]+)/ig
    res.map(item => {
      const parts = [...(item.matchAll(reg))]
      // TODO: Convert unit
      return parts
    })



  }
}

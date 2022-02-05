import moment from "moment";
import DingBot from "../DingBot";
import Logger from "../Logger";
import { DATA_KEY_ACCOUNT_INFO, DATA_KEY_MINING, DATA_KEY_REPORT, IAccountInfo, IMiningData, IReportConfig } from "../types";
import BaseTask, { TaskState } from "./BaseTask"

export interface IReportResult {
  state: number
}

const logger = new Logger('Report')

export default class Report extends BaseTask<IReportResult> {
  constructor() {
    super('Report')

    this.registerStep('report', this.stepReport, true);
  }

  private stepReport() {
    const conf = this.provider.getData<IReportConfig>(DATA_KEY_REPORT)
    let nextReportTime = conf.nextReportTime || 0
    const needReport = (new Date().getTime()) > nextReportTime
    const interval = (conf.interval || 28800) * 1000
    nextReportTime = Math.ceil((new Date().getTime()) / interval) * interval

    if (needReport) {
      const account = this.provider.getData<IAccountInfo>(DATA_KEY_ACCOUNT_INFO)
      const mining = this.provider.getData<IMiningData>(DATA_KEY_MINING)

      const message = `AW [${account.account}] Report
      TLM: ${mining.total}
      STAKE: ${mining.stakeTotal}
      `
      DingBot.getInstance().text(message)

      logger.log(`Report: ${mining.total} TLM, ${mining.stakeTotal} WAXP staked. Next report scheduled at: ${moment(nextReportTime).format('YYYY-MM-DD HH:mm:ss')}`)
    }

    conf.nextReportTime = nextReportTime
    this.provider.setData(DATA_KEY_REPORT, conf)
    this.provider.saveData()
    this.complete(TaskState.Completed, '', null, nextReportTime)
  }
}

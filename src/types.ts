export const DATA_KEY_BROWSER = 'BROWSER'
export const DATA_KEY_COOKIE = 'cookies'
export const DATA_KEY_ACCOUNT_INFO = 'account'
export const DATA_KEY_MINING = 'mining'
export const DATA_KEY_REPORT = 'report'

export interface IBrowserConfig {
  userAgent: string
}

export interface IAccountInfo {
  account: string
  username: string
  password: string
}

export interface TaskObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Class: any
  // Set 0 to make task always running
  life: number
  awakeTime: number,
  awakeTimeStr?: string
}

export interface ICookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  size?: number
  httpOnly?: boolean
  secure?: boolean
  session?: boolean
  sameParty?: boolean
  sourceScheme?: string
  sourcePort?: number
}

export interface IMiningData {
  total: number
  rewards: number
  stakeTotal: number
  stakeRewardTotal: number
  stakeRewardLast: number
}

export interface ITaskSavableData {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any
}

export interface IMinionData {
  account: IAccountInfo
  cookies: ICookie[]
  mining: IMiningData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [task: string]: any
}

export interface IReportConfig {
  // Report interval defined in seconds
  interval: number,
}

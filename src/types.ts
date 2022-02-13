import { Metrics, Protocol } from "puppeteer"
import { ConsoleMessage, Dialog, Frame, HTTPRequest, HTTPResponse, Page, WebWorker } from "puppeteer"

export const DATA_KEY_SESSION_ID = 'session_id'
export const DATA_KEY_BROWSER = 'BROWSER'
export const DATA_KEY_COOKIE = 'cookies'
export const DATA_KEY_ACCOUNT_INFO = 'account'
export const DATA_KEY_MINING = 'mining'
export const DATA_KEY_REPORT = 'report'

export interface IBrowserConfig {
  userAgent: string
}

export interface IAccountInfo {
  logined: boolean
  account: string
  username: string
  password: string
}

export interface TaskObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Class: any
  // Set 0 to make task always running
  life: number
  awakeTime: number
  awakeTimeStr?: string
  interactive: boolean
}

export type CookieObject = Protocol.Network.CookieParam

export interface IResourceLimit {
  available: number
  max: number
  used: number
}

export interface IMiningData {
  total: number
  rewards: number
  stakeTotal: number
  stakeRewardTotal: number
  stakeRewardLast: number
  counter: number
  //
  cpuLimit?: IResourceLimit
  netLimit?: IResourceLimit
  cpuWeight?: number
  netWeight?: number
  ramQuota?: number
  ramUsage?: number
}

export interface ITaskSavableData {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any
}

export interface IMinionData {
  account: IAccountInfo
  cookies: CookieObject[]
  mining: IMiningData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [task: string]: any
}

export interface IReportConfig {
  // Report interval defined in seconds
  interval: number
  // Last report timestamp
  nextReportTime: number
}

export type PageEventCommonHandle = () => void
export type PageEventErrorHandle = (error: Error) => void
export type PageEventPageHandle = (popup: Page) => void
export type PageEventConsoleHandle = (message: ConsoleMessage) => void
export type PageEventDialogHandle = (dialog: Dialog) => void
export type PageEventFrameHandle = (frame: Frame) => void
export type PageEventRequestHandle = (request: HTTPRequest) => void
export type PageEventResponseHandle = (response: HTTPResponse) => void
export type PageEventWebWorkerHandle = (webworker: WebWorker) => void
export type PageEventMetricsHandle = (webworker: {
  title: string;
  metrics: Metrics;
}) => void

export interface PageEventHandleObject {
  close?: PageEventCommonHandle
  console?: PageEventConsoleHandle
  dialog?: PageEventDialogHandle
  domcontentloaded?: PageEventCommonHandle
  error?: PageEventErrorHandle
  frameattached?: PageEventFrameHandle
  framedetached?: PageEventFrameHandle
  framenavigated?: PageEventFrameHandle
  load?: PageEventCommonHandle
  metrics?: PageEventMetricsHandle
  pageerror?: PageEventErrorHandle
  popup?: PageEventPageHandle
  request?: PageEventRequestHandle
  response?: PageEventResponseHandle
  requestfailed?: PageEventRequestHandle
  requestfinished?: PageEventRequestHandle
  requestservedfromcache?: PageEventRequestHandle
  workercreated?: PageEventWebWorkerHandle
  workerdestroyed?: PageEventWebWorkerHandle
}

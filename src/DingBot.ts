/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Dingding talk robot
 *
 * References:
 * - [Get Start](https://open.dingtalk.com/document/robots/custom-robot-access#title-jfe-yo9-jl2)
 * - [Message Types](https://open.dingtalk.com/document/robots/custom-robot-access#title-72m-8ag-pqw)
 */

import axios from "axios"
import crypto from 'crypto'

// const DingBot = new DingDingBot(config.dingding)
export interface IDingBotConfig {
  webhook: string
  secret: string
}

export interface IDingAtGroup {
  atMobiles?: string[]
  atUserIds?: string[]
  isAtAll?: boolean
}

export interface IDingText {
  text: string
  at?: IDingAtGroup
}

// export interface IDingLink {}
// export interface IDingMarkDown {}
// export interface IDingActionCard {}
// export interface IDingFeedCard {}

// type IDingMesssage = IDingText

let _instance = null

export default class DingBot {

  static getInstance(conf?: IDingBotConfig): DingBot {
    if (_instance === null) {
      _instance = new DingBot()
      if (conf) {
        _instance.initial(conf)
      }
    }

    return _instance
  }

  private conf: IDingBotConfig

  constructor() {
    if (_instance) {
      throw new Error('DingBot is a singleton.')
    }
  }

  initial(conf: IDingBotConfig) {
    this.conf = conf
  }

  private _send(message: any): Promise<any> {
    if (!this.conf.webhook || !this.conf.secret) {
      return null
    }

    const timestamp = new Date().getTime()
    const msgToSign = timestamp + "\n" + this.conf.secret

    const sign = crypto.createHmac('sha256', this.conf.secret)
      .update(msgToSign)
      .digest()
      .toString('base64')
    const url = `${this.conf.webhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
    return axios.post(url, message, {})
  }

  text(content: string, at?: IDingAtGroup | boolean): Promise<any> {
    return this._send({
      at: typeof at === 'boolean' ? { isAtAll: at } : at,
      text: {
        content: content
      },
      msgtype: 'text'
    })
  }

  link() {
    throw new Error('not implement yet!')
  }

  markdown() {
    throw new Error('not implement yet!')
  }

  actionCard() {
    throw new Error('not implement yet!')
  }

  feedCard() {
    throw new Error('not implement yet!')
  }
}



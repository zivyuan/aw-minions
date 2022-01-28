import fs from 'fs'
import yargs from "yargs"
import { hideBin } from 'yargs/helpers'
import puppeteer, { Browser } from "puppeteer"
import { BrowserLaunchArgumentOptions, ConnectOptions, LaunchOptions } from "puppeteer"
import Logger from './Logger'
import config from './config'
import WaxLogin from './tasks/WaxLogin'
import DingBot from './DingBot'
import Minion from './Minion'
import Mining from './tasks/Mining'
import AWLogin from './tasks/AWLogin'

interface IBotArguments {
  /**
   * Wax wallet account
   */
  username: string[]
  /**
   * Wax wallet password
   */
  password: string[]
  /**
   * Wax blockchain account
   */
  account: string[]
  /**
   * Json formatted account list
   * !!! NOT IMPLEMENTED YET !!!
   */
  accounts: string
  /**
   * Set a proxy
   *   --proxy             Set default proxy: 127.0.0.1:7890
   *   --proxy host:port   Set new proxy address
   */
  proxy: boolean | string
  /**
   * Use an endpoint to speed up page loading in develop
   */
  endpoint: string
  /**
   * Social network openid surpport
   * !!! NOT IMPLEMENTED YET !!!
   */
  platform: string
  /**
   * Show devtool when page open
   */
  dev: boolean
}


// Just initialize
const logger = new Logger('Main')
DingBot.getInstance(config.dingding)

const getProxy = (proxy): string => {
  return proxy === true
  ? `${config.proxy.host}:${config.proxy.port}`
  : proxy
}

const createBrowser = async (argv: IBotArguments): Promise<Browser> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _create = async (resolve, _reject) => {
    const option: LaunchOptions & BrowserLaunchArgumentOptions & ConnectOptions = {
      ...config.browserOption,
      devtools: argv.dev
    }
    let browser = null;
    if (argv.endpoint) {
      if (/^ws:\/\//.test(argv.endpoint)) {
        option.browserWSEndpoint = argv.endpoint
      } else {
        const ep = fs.readFileSync('.endpoint').toString().trim()
        option.browserWSEndpoint = ep
      }
      browser = await puppeteer.connect(option);
    } else {
      if (argv.proxy) {
        option.args.push(`--proxy-server=${getProxy(argv.proxy)}`)
      }
      browser = await puppeteer.launch(option);
    }

    resolve(browser)
  }

  return new Promise((resolve, reject) => {
    _create(resolve, reject)
  })
};

/**
 * Main proccess
 */
(async () => {
  //
  // Initial command line arguments
  //
  const argv = <IBotArguments>yargs(hideBin(process.argv))
    .option("username", {
      alias: "u",
      describe: "Social account to login in Alien Worlds",
      array: true,
    })
    .option("password", {
      alias: "p",
      describe: "The password of the account",
      array: true,
    })
    .option("account", {
      alias: 'a',
      describe: "The id of the account",
      array: true,
    })
    .option("platform", {
      alias: "P",
      describe: "Social platform",
      choices: ["github"],
      default: "github",
    })
    .option("endpoint", {
      describe: "Develop option for fast load"
    })
    .option("accounts", {
      describe: "Account pool json file",
    })
    .option("proxy", {
      describe: "Use SwitchOmega proxy",
    })
    .option("dev", {
      describe: "Use SwitchOmega proxy",
      boolean: true,
    })
    .demandOption(["username", "password"])
    .help("help").argv;

  if (argv.username.length > 1) {
    logger.log('Alien World\'s minions are weaking...')
  } else {
    logger.log('Alien World\'s minion is weaking...')
  }
  // Initialize browser
  const browser = await createBrowser(argv);
  //
  if (argv.endpoint) {
    const pages = await browser.pages()
    while(pages.length > 1) {
      const page = pages.shift()
      await page.close()
    }
  }

  Logger.account = (argv.account && argv.account.length) ? argv.account[0].trim() : ''
  const minion = new Minion(argv.username[0], argv.password[0])
  minion.prepare(browser)
  minion.addTask(WaxLogin, 1)
  minion.addTask(AWLogin, 1)
  minion.addTask(Mining)
  minion.start()
})();



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
import AWLogin from './tasks/AWLogin'
import Mining from './tasks/Mining'
// import ClaimStakeRewards from './tasks/ClaimStakeRewards'
// import Report from './tasks/Report'

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
   * Show devtool when page open
   */
  dev: boolean
  //
  enablefont: boolean
  enableimage: boolean
  enablecss: boolean
}

// =================================

let logger
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
    let browser: Browser = null;
    if (argv.endpoint) {
      if (/^ws:\/\//.test(argv.endpoint)) {
        option.browserWSEndpoint = argv.endpoint
      } else {
        const ep = fs.readFileSync('.endpoint').toString().trim()
        option.browserWSEndpoint = ep
      }
      logger.debug('Connect options: ', option)
      browser = await puppeteer.connect(option);
    } else {
      if (argv.proxy) {
        option.args.push(`--proxy-server=${getProxy(argv.proxy)}`)
      }
      logger.debug('Launch options: ', option)
      browser = await puppeteer.launch(option);
    }

    const pages = await browser.pages()
    // Remove all tabs created in preview sessiono
    if (argv.endpoint) {
      // In windows and linux system, the last tab closed means the whole application
      // should be closed, so create empty tab first.
      const lastPage = await browser.newPage()
      while (pages.length) {
        const page = pages.shift()
        await page.close()
      }
      pages.push(lastPage)
    }

    await pages[0].evaluate(`document.title = '${argv.account[0].trim()}'`)

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
      describe: "Email to login in Alien Worlds",
      array: true,
      default: [],
    })
    .option("password", {
      alias: "p",
      describe: "The password of the account",
      array: true,
      default: []
    })
    .option("account", {
      alias: 'a',
      describe: "The id of the account",
      array: true,
    })
    .option("endpoint", {
      describe: "Use a preopened Chromium as endpoint to improve development"
    })
    .option("accounts", {
      describe: "Account pool json file",
    })
    .option("proxy", {
      describe: "Use SwitchOmega proxy",
    })
    .option("dev", {
      describe: "Enable develop settings",
      boolean: true,
      default: false,
    })
    // enablecss always set to true
    // Disable css will cause page hang up. Ignore this optmize feature
    .option("enablecss", {
      describe: "Allow CSS resources",
      boolean: true,
      default: true,
    })
    .option("enablefont", {
      describe: "Allow font resources",
      boolean: true,
      default: false,
    })
    .option("enableimage", {
      describe: "Allow image resources",
      boolean: true,
      default: false,
    })
    .demandOption(["account"])
    .help("help").argv;

  // Just initialize
  Logger.debug = argv.dev
  Logger.account = argv.account[0].trim()
  logger = new Logger('Main')

  const lockfile = './cache/window-lock'
  if (fs.existsSync(lockfile)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockfile).toString())
      if (lock && lock.account === argv.account[0].trim()) {
        fs.unlinkSync('./cache/window-lock')
      }
    } catch (err) { }
  }

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
    while (pages.length > 1) {
      const page = pages.shift()
      await page.close()
    }
  }

  const minion = new Minion(argv.account[0], argv.username[0], argv.password[0])
  minion.prepare(browser, {
    enableCSS: true,
    enableImage: argv.dev || argv.enableimage,
    enableFont: argv.dev || argv.enablefont
  })
  minion.addTask(WaxLogin)
  minion.addTask(AWLogin)
  minion.addTask(Mining)
  // minion.addTask(ClaimStakeRewards)
  // minion.addTask(Report)
  minion.start()
})();



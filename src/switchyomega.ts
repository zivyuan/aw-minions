import { Page } from "puppeteer"
import { sleep } from "sleep"
import Logger from "./Logger"

const selectAll = (ipt) => ipt.select()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proxyInstallGuide = (page: Page): Promise<any> => {
  const promiseWrapper = async (resolve) => {
    const html = `<style>
    #so-helper {
        position: fixed;
        z-index: 9999999;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.5);
        top: 0px;
        left: 0px;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
    }

    #so-helper strong {
        font-weight: bold;
        margin: 0 1em;
    }

    #so-helper p {
        color: #FFF;
    }
</style>
<div style="max-width: 400px;">
    <p>Set SwitchyOmega proxy mode as <strong>[auto switch]</strong></p>
    <p>&nbsp;</p>
    <p>Press 👇👇👇👇 after set.</p>
    <button id="so-confirm">I am ready!</button>
    <script>
    </script>
</div> `
    // Open proxy switchy omega cause script run twice again
    // So need to prevent the second injection.
    const markId = 'so-helper'
    const script = ` (() => {
      const helper = document.getElementById('${markId}');
      if (helper) return

      const div = document.createElement('div');
      div.id = '${markId}';
      div.innerHTML = ${JSON.stringify({ html })}.html;
      document.body.append(div)
      setTimeout(() => {
        const btn = document.getElementById('so-confirm')
        btn.addEventListener('click', () => {
            document.getElementById('so-helper').remove()
        })
      }, 300)
  })() `;
    await page.evaluate(script)

    const checkButton = async () => {
      const btn = await page.$(`#${markId}`)
      if (!btn) {
        resolve(page)
      } else {
        setTimeout(() => {
          checkButton()
        }, 500)
      }
    }

    checkButton()
  }

  return new Promise((resolve) => {
    promiseWrapper(resolve)
  })
}

const logger = new Logger('SwitchyOmega')
export default {
  initial: async (page: Page) => {
    logger.log('config Proxy SwitchyOmega')

    await proxyInstallGuide(page)

    // Close intro modal
    const mbtn = await page.$('.modal-dialog .modal-header button')
    if (mbtn) {
      await page.click('.modal-dialog .modal-header button')
    }

    // Select default mode
    logger.log('set default mode...')
    await page.click('nav li:nth-child(2) a')
    sleep(1)
    await page.click('main .settings-group button.dropdown-toggle')
    sleep(2)
    await page.click('main .settings-group button.dropdown-toggle+ul.dropdown-menu li:nth-child(2)')
    sleep(1)
    // Save
    await page.click('nav li .btn-success')
    sleep(2)

    // Config proxy setting
    logger.log('set socket5...')
    await page.click('nav li[data-profile-type="FixedProfile"] a')
    sleep(2)
    // Select protocol
    await page.select('.fixed-servers tr.ng-scope:nth-child(1) select', 'string:socks5')

    // Input address
    const iptAddr = '.fixed-servers tr.ng-scope:nth-child(1) input:not(.ng-valid-min)'
    await page.$eval(iptAddr, selectAll)
    await page.type(iptAddr, '127.0.0.1')

    // Input port
    const iptPort = '.fixed-servers tr.ng-scope:nth-child(1) input.ng-valid-min'
    await page.$eval(iptPort, selectAll)
    await page.type(iptPort, '9999')

    sleep(1)
    // Save proxy
    await page.click('nav li .btn-success')
    sleep(2)

    //
    logger.log('set rules...')
    await page.click('nav li[data-profile-type="SwitchProfile"] a')
    sleep(2)
    // Skip tutorial
    const selTutorial = '.shepherd-button-secondary'
    const btnTutorial = await page.$(selTutorial)
    if (btnTutorial) {
      await page.click(selTutorial)
    }

    sleep(2)
    const addRule = async (rule: string) => {
      await page.click('.switch-rules tr button[ng-click="addRule()"]')
      sleep(1)
      await page.$eval('.switch-rules tr.switch-rule-row:last-child input', selectAll)
      await page.type('.switch-rules tr.switch-rule-row:last-child input', rule)
      sleep(1)
    }
    const rules = [
      '*.wax.io',
      '*.gstatic.com',
      '*.google.com',
      '*.googleapis.com',
      '*.cloudflareinsights.com',
      "*.googletagmanager.com"
    ]
    let rule
    while ((rule = rules.shift())) {
      await addRule(rule)
    }
    sleep(1)
    // Save proxy
    await page.click('nav li .btn-success')
    sleep(1)

    // All set
    logger.log('Proxy config all down!')
  }
}

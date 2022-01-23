const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Initial endpoint browser...');
  const browser = await puppeteer.launch({
    headless: false,
    deviceScaleFactor: 2,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--window-size=800,680', '--unhandled-rejections=strict'],
    viewport: {
      width: 960,
      height: 600,
    }
    // devtools: true,
  });

  const endPoint = browser.wsEndpoint();
  fs.writeFileSync('.endpoint', endPoint);
  console.log('End ready: \n\t ', endPoint);
})();

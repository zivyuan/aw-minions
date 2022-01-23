/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'window' {
  global {
    function setTimeout(handle: any, delay: number, ...args): number
    function setInterval(handle: any, delay: number, ...args): number
  }
}


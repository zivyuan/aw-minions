export const UTCtoGMT = (utcDate: string | number | Date): Date => {
  let cov = new Date(utcDate)
  cov = new Date(cov.getTime() - cov.getTimezoneOffset() * 60000)
  return cov
}

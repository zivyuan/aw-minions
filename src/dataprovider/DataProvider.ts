export interface DataProvider {
  load: (data: string) => Promise<unknown>
}

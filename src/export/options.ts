export interface ReportOptions {
  regularPay: boolean
  overtimePay: boolean
  expenses: boolean
  hourlyRate: boolean
  addresses: boolean
  timesAndBreak: boolean
}

export const defaultOptions: ReportOptions = {
  regularPay: true,
  overtimePay: true,
  expenses: true,
  hourlyRate: true,
  addresses: true,
  timesAndBreak: true,
}

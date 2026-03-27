import axios from 'axios'
import { supabase } from '../config/supabase'
import logger from '../logger'

class FxService {
  /**
   * Get FX rate for a given date. Falls back to the closest available rate if exact date not found.
   * If from === to, returns 1.
   */
  async getRate(date: string, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1

    const { data } = await supabase
      .from('fx_rates')
      .select('rate')
      .eq('from_currency', fromCurrency.toUpperCase())
      .eq('to_currency', toCurrency.toUpperCase())
      .lte('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (data?.rate) return Number(data.rate)

    // Try reverse rate
    const { data: reverse } = await supabase
      .from('fx_rates')
      .select('rate')
      .eq('from_currency', toCurrency.toUpperCase())
      .eq('to_currency', fromCurrency.toUpperCase())
      .lte('date', date)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (reverse?.rate) return 1 / Number(reverse.rate)

    logger.warn(`FX rate not found for ${fromCurrency}→${toCurrency} on ${date}, using 1.0`)
    return 1
  }

  /**
   * Fetch and store latest rates from Frankfurter (ECB proxy)
   * Fetches all major currencies to the configured reporting currency.
   */
  async fetchAndStoreLatestRates(reportingCurrency = 'USD'): Promise<void> {
    const currencies = ['USD', 'EUR', 'GBP', 'TRY', 'CHF', 'JPY', 'CAD', 'AUD']
    const targets = currencies.filter((c) => c !== reportingCurrency)

    try {
      const { data } = await axios.get(`https://api.frankfurter.app/latest`, {
        params: {
          from: reportingCurrency,
          to: targets.join(','),
        },
        timeout: 10000,
      })

      const date = data.date
      const rates = data.rates as Record<string, number>

      const rows = Object.entries(rates).map(([currency, rate]) => ({
        date,
        from_currency: currency,   // Store as "1 X = N reportingCurrency"
        to_currency: reportingCurrency,
        rate: 1 / rate,            // Invert: from X to reportingCurrency
        source: 'ecb',
      }))

      // Also add reporting→reporting identity
      rows.push({
        date,
        from_currency: reportingCurrency,
        to_currency: reportingCurrency,
        rate: 1,
        source: 'ecb',
      })

      const { error } = await supabase
        .from('fx_rates')
        .upsert(rows, { onConflict: 'date,from_currency,to_currency' })

      if (error) logger.error('FX rate store error', error)
      else logger.info(`FX rates stored for ${date} (${rows.length} pairs)`)
    } catch (err) {
      logger.error('Failed to fetch FX rates from Frankfurter', err)
    }
  }
}

export const fxService = new FxService()

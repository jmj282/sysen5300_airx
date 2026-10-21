import { describe, expect, it } from 'vitest'
import { num, pct, specText, usd } from './format.js'

describe('display helpers', () => {
  it('formats missing values as a dash, never as a made-up number', () => {
    expect(num(null)).toBe('—')
    expect(pct(undefined)).toBe('—')
    expect(usd(null)).toBe('—')
  })
  it('formats numbers', () => {
    expect(num(2.1234)).toBe('2.12')
    expect(pct(0.1453)).toBe('14.5%')
    expect(usd(19779.4)).toBe('$19,779')
  })
  it('writes one- and two-sided specs', () => {
    expect(specText({ lower: 1, upper: 6 })).toBe('1–6 °C')
    expect(specText({ lower: null, upper: -18 })).toBe('≤ -18 °C')
  })
})

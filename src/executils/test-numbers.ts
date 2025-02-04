import Decimal from 'decimal.js'

// Test some calculations
const amount = new Decimal('1774925')
const factor = new Decimal('1000000')
const result = amount.dividedBy(factor)
console.log(result.toString())

// Compare with regular JS division
console.log(1774925 / 1000000)

// Test multiplication too
const usdRate = new Decimal('0.15')
const usdValue = amount.times(usdRate)
console.log(usdValue.toString())
# Australian Powerball — Statistical Analysis Measures

**Game format:** 7 main numbers (1–35) + 1 Powerball (1–20)

**Dataset:** Historical draws using the current Powerball format (April 2018 onwards).

**Purpose:** Analyse historical distributions, numerical relationships, drawing patterns, and statistical significance.

> Note: In a fair lottery, each valid combination has an equal probability of winning. Historical frequency or overdue patterns do not increase future winning probabilities.

## Category 1: Basic Statistical Measures

| #   | Statistical Measure     | Explanation                                                                    | Example                  |
| --- | ----------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| 1   | Low / High Distribution | Count numbers within predefined low and high ranges, such as 1–17 and 18–35.   | 3 Low / 4 High           |
| 2   | Even / Odd Distribution | Count even and odd numbers in each draw.                                       | 4 Even / 3 Odd           |
| 3   | Minimum / Maximum       | Identify the smallest and largest main numbers in each draw.                   | Min = 3, Max = 35        |
| 4   | Longest Consecutive Run | Find the longest sequence of consecutive integers within a draw.               | 8, 9, 10 = Run of 3      |
| 5   | Small Gaps              | Count differences between sorted adjacent numbers below a specified threshold. | Gaps <= 3: 2 occurrences |
| 6   | Previous-Draw Overlap   | Count numbers repeated from the immediately preceding draw.                    | 2 repeated numbers       |
| 7   | Exact Sum               | Calculate the sum of all seven main numbers.                                   | Sum = 119                |

## Category 2: Number Frequency and Distribution

| #   | Statistical Measure | Explanation                                                                      | Example                                  |
| --- | ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| 8   | Hot Numbers         | Identify numbers with the highest appearance frequency within a defined period.  | Number 12 appeared 25 times in 100 draws |
| 9   | Cold Numbers        | Identify numbers with the lowest appearance frequency within a defined period.   | Number 31 appeared 12 times in 100 draws |
| 10  | Number Overdue      | Count draws since each main number last appeared.                                | Number 14 absent for 15 draws            |
| 11  | Frequency Trend     | Compare number frequencies across different historical windows.                  | Last 10 vs 30 vs 100 draws               |
| 12  | Frequency Deviation | Compare observed frequency against expected frequency under fair random draws.   | Expected 20, Actual 26, Deviation +6     |
| 13  | Number Position     | Analyse distributions at each sorted position (1st through 7th).                 | Median sorted number = 18                |
| 14  | Range Distribution  | Divide numbers into fixed numerical bands and count how many occur in each band. | Bands 1–7, 8–14, 15–21, 22–28, 29–35     |

## Category 3: Number Relationships and Combinations

| #   | Statistical Measure | Explanation                                                                  | Example                             |
| --- | ------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| 15  | Pair Frequency      | Count how often each unordered pair of numbers appears together.             | Pair (7, 12) appeared 9 times       |
| 16  | Triple Frequency    | Count how often each unordered three-number combination appears together.    | Triple (4, 15, 23) appeared 3 times |
| 17  | Consecutive Pairs   | Count adjacent-number pairs whose values differ by exactly 1.                | (8, 9), (23, 24) = 2 pairs          |
| 18  | Gap Distribution    | Calculate all six differences between sorted adjacent main numbers.          | [5, 1, 8, 6, 1, 11]                 |
| 19  | Gap Variance        | Measure how unevenly the six gaps are distributed.                           | Variance of [5, 1, 8, 6, 1, 11]     |
| 20  | Range Span          | Calculate the difference between the maximum and minimum main numbers.       | 35 - 3 = 32                         |
| 21  | Cluster Count       | Group nearby numbers using a defined maximum-gap threshold.                  | Gap <= 2 groups 8–9 and 23–24       |
| 22  | Last-Digit Patterns | Count numbers sharing the same final decimal digit.                          | 7, 17, 27 share digit 7             |
| 23  | Modulo Patterns     | Group numbers according to their remainder when divided by a chosen divisor. | Modulo 3 remainder counts           |

## Category 4: Historical Sequence and Draw Relationships

| #   | Statistical Measure       | Explanation                                                                            | Example                                        |
| --- | ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 24  | Previous 2–5 Draw Overlap | Count numbers appearing in one or more of the previous 2–5 draws.                      | 4 numbers appeared within the previous 5 draws |
| 25  | Repeat Intervals          | Measure the number of draws between consecutive appearances of an individual number.   | Number 17 reappeared after 6 draws             |
| 26  | Pair Recurrence Intervals | Measure draws between consecutive appearances of the same unordered pair.              | Pair (7, 12) reappeared after 35 draws         |
| 27  | Combination Similarity    | Count numbers shared by two historical draws; optionally calculate Jaccard similarity. | 3 shared numbers                               |
| 28  | Sum Movement              | Measure the change in total main-number sum between consecutive draws.                 | Previous = 110, Current = 127, Change = +17    |
| 29  | Pattern Transitions       | Analyse changes in pattern classifications across consecutive draws.                   | 4 Odd / 3 Even followed by 3 Odd / 4 Even      |

## Category 5: Mathematical Properties

| #   | Statistical Measure    | Explanation                                                         | Example                         |
| --- | ---------------------- | ------------------------------------------------------------------- | ------------------------------- |
| 30  | Prime Number Count     | Count main numbers that are prime.                                  | 3, 11, 17 = 3 primes            |
| 31  | Multiple Count         | Count numbers divisible by a selected divisor, such as 3, 5, or 7.  | Multiples of 5: 5, 15, 35       |
| 32  | Fibonacci Number Count | Count main numbers belonging to the Fibonacci sequence.             | 1, 2, 3, 5, 8, 13, 21, 34       |
| 33  | Standard Deviation     | Measure the dispersion of the seven main numbers around their mean. | High SD = widely spread numbers |
| 34  | Median                 | Identify the fourth number in the sorted seven-number combination.  | [3, 8, 9, 17, 23, 24, 35] → 17  |
| 35  | Sum by Region          | Calculate separate sums for predefined low and high ranges.         | Low Sum = 37, High Sum = 82     |

## Category 6: Powerball-Specific Analysis

| #   | Statistical Measure             | Explanation                                                                      | Example                                            |
| --- | ------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| 36  | Powerball Frequency             | Count how often each Powerball number (1–20) appears.                            | Powerball 7 appeared 15 times                      |
| 37  | Powerball Waiting Time          | Measure draws since each Powerball value last appeared.                          | Powerball 12 absent for 18 draws                   |
| 38  | Powerball Consecutive Repeats   | Count occurrences where consecutive draws share the same Powerball number.       | Powerball 6 appeared twice consecutively           |
| 39  | Powerball-Main Overlap          | Count draws where the Powerball value also appears among the seven main numbers. | Main includes 12, Powerball = 12                   |
| 40  | Powerball-Main Sum Relationship | Analyse correlation between Powerball value and the sum of seven main numbers.   | Pearson correlation between Powerball and main sum |

## Category 7: Advanced Statistical Testing

| #   | Statistical Measure         | Explanation                                                                                          | Example                                     |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 41  | Chi-Square Goodness-of-Fit  | Test whether observed number frequencies significantly differ from a uniform distribution.           | Compare frequencies of numbers 1–35         |
| 42  | Autocorrelation             | Test associations between a number's appearances at different draw lags.                             | Appearance at draw t vs draw t-1            |
| 43  | Monte Carlo Simulation      | Generate large numbers of random draws to establish expected distributions and confidence intervals. | Simulate 1,000,000 draws                    |
| 44  | Entropy                     | Quantify the diversity or concentration of an observed probability distribution.                     | Shannon entropy of number frequencies       |
| 45  | Rolling-Window Stability    | Examine how statistics change as the historical observation window moves forward.                    | Rolling 50-draw odd/even distribution       |
| 46  | Backtesting                 | Evaluate selection strategies using only information available before each historical draw.          | Train on first 500 draws, test on next 100  |
| 47  | Multiple-Testing Correction | Adjust significance thresholds when testing many hypotheses to reduce false positives.               | Bonferroni or Benjamini-Hochberg correction |

## Recommended Analysis Priority

| Priority | Measures | Purpose                                                    |
| -------- | -------- | ---------------------------------------------------------- |
| P1       | 1–7      | Establish fundamental draw characteristics                 |
| P1       | 8–14     | Understand historical number frequency and distribution    |
| P1       | 15–23    | Analyse relationships, clustering and number combinations  |
| P1       | 24–29    | Analyse draw-to-draw relationships and recurrence          |
| P2       | 30–35    | Examine additional mathematical characteristics            |
| P1       | 36–40    | Analyse the independent Powerball pool                     |
| P1       | 41–43    | Compare observed patterns against statistical expectations |
| P2       | 44–45    | Examine entropy and stability across time                  |
| P1       | 46–47    | Validate strategies and control false discoveries          |

## Recommended Additional Derived Metrics

| Metric                             | Formula or Method                          | Purpose                                                      |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Main Number Appearance Probability | 7 / 35 = 20%                               | Theoretical probability that one specified number appears    |
| Powerball Appearance Probability   | 1 / 20 = 5%                                | Theoretical probability of one specified Powerball           |
| Expected Main Number Frequency     | Number of Draws × 0.20                     | Baseline for frequency analysis                              |
| Expected Powerball Frequency       | Number of Draws × 0.05                     | Baseline for Powerball analysis                              |
| Frequency Z-Score                  | (Observed - Expected) / Standard Deviation | Standardise frequency deviation                              |
| Jaccard Similarity                 | Intersection Size / Union Size             | Compare two historical combinations                          |
| Exact Main Combination Count       | C(35,7) = 6,724,520                        | Number of possible main-number combinations                  |
| Complete Combination Count         | C(35,7) × 20 = 134,490,400                 | Number of possible complete Powerball entries                |
| Jackpot Probability per Entry      | 1 / 134,490,400                            | Probability of matching all 7 main numbers and the Powerball |

## Analysis Guidelines

1. Analyse main numbers and Powerball values separately unless studying their relationship.
2. Use consistent definitions for low/high ranges, gap thresholds and clusters.
3. Sort main numbers before computing positional measures and adjacent gaps.
4. Maintain chronological draw order for overlap, recurrence and transition analysis.
5. Use rolling observation windows to compare short-term and long-term distributions.
6. Compare observed statistics with theoretical distributions or Monte Carlo simulations.
7. Correct for multiple hypothesis testing when investigating many potential patterns.
8. Use walk-forward backtesting to prevent future data from leaking into historical predictions.
9. Track winnings, match counts, ticket costs and returns when testing strategies.
10. Do not interpret hot, cold or overdue numbers as having intrinsically better future odds.

# Complete synthetic salary test sources

The three text fixtures are unchanged copies of publicly available synthetic tests from `naatti21/Palkan-laskenta`, Git SHA `550c765413c0916259c67b44ba8dfdb9b3f06da6`: `tests/fixtures/acceptance-a-modern.txt`, `tests/fixtures/test-format-b-compact.txt`, and `tests/fixtures/acceptance-c-alt-terms.txt`. They contain invented monetary amounts, pay dates and payroll rows, no user-provided or real payslips. Existing source tests assert `payDate=2026-08-28`, `grossPay=4698.11`, `netPay=2678.39`, `ytdTaxableIncome=63832.82` for these sources.

The LAB generates one-page *actual PDF bytes* from them at test runtime. The PDF source-to-text fidelity and its limits must be assessed independently: the fact that a raw text fixture is accepted does not prove that PDF text extraction preserves every word/number.

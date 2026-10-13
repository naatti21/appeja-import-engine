# GitHub archival validation - 14.10.2026

Six existing DEV PDFs copied byte-for-byte; no regeneration. Six annotations copied byte-for-byte. Each PDF opened with PyMuPDF; all annotated raw texts matched the specified page/source region again. Original SHA-256 hashes matched for all twelve data files. All required files present.

Original validation also used Poppler rendering, pdfinfo, pdfplumber and PDF.js 5.6.205; final rendered pages were visually checked by one agent. The DEV PDFs have seven pages. Text values include only fictional identities and data, explicitly marked synthetic. No real user PDFs, account numbers or personal IDs are included.

Public staging uses a whitelist: README, DEV PDFs, DEV JSON annotations, manifest, test protocol and this report. No master ZIP, private source generator, HOLDOUT files, answers, extracted observations or evaluator metadata are uploaded. Public manifest carries only the private HOLDOUT ZIP hash, count and version.

Limitations: single-agent provisional truth; synthetic documents; PDF.js 6.4.299 browser/Android NOT RUN; Import Engine NOT RUN. Branch-only archival, no PR, merge or production change. This report does not claim baseline PASS.

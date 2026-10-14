"""Offline QA corpus structural check, independent of application parsers.

Checks 60 cases, oracle-first fields, 5 real files/case, CSV truth, image
decode, native PDF read and provenance. Does NOT run LAB v1.3 import.
"""
import csv
import hashlib
import io
import json
import os
import sys
from collections import Counter
from pathlib import Path
from PIL import Image
from pypdf import PdfReader

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else "qa-output/corpus").resolve()
OUTPUT=Path(os.environ.get("QA_CORPUS_REPORT_DIR","qa-output")).resolve()
OUTPUT.mkdir(parents=True,exist_ok=True)
scenarios=[
 "clean","missing_cost","missing_currency","conflicting_value",
 "ambiguous_decimal","malformed_number","zero_quantity",
 "separate_accounts","repeated_holding","duplicate_column",
 "unknown_money","missing_quantity"
]
names=["source.csv","source.png","source.jpg","source.pdf","source.xlsx"]
manifest=json.loads((ROOT/"manifest.json").read_text())
if not isinstance(manifest,list) or len(manifest)!=60:
 raise SystemExit("EXPECTED_60_CASES")
if len({x["case_id"] for x in manifest})!=60:raise SystemExit("DUPLICATE_CASE")
digest=lambda b:hashlib.sha256(b).hexdigest()
hashes={}
family=Counter()
sourceCount=0
sourceRefs=0
for n,entry in enumerate(manifest):
 seed=130000+n
 scenario=scenarios[n%len(scenarios)]
 case=f"S{seed}-{scenario}"
 if entry["case_id"]!=case or entry["seed"]!=seed or entry["scenario"]!=scenario:
  raise SystemExit("BAD_CASE_ID "+str(entry))
 if entry.get("status")!="NOT_RUN":raise SystemExit("INVALID_TEST_STATUS "+case)
 directory=ROOT/case
 if not directory.is_dir():raise SystemExit("CASE_NOT_FOUND "+case)
 oracle=json.loads((directory/"oracle.json").read_text())
 source=json.loads((directory/"sources.json").read_text())
 if oracle["case_id"]!=case or oracle["seed"]!=seed or oracle["scenario"]!=scenario:
  raise SystemExit("ORACLE_METADATA_MISMATCH "+case)
 matrix=oracle["matrix"]
 if len(matrix)!=len(oracle["rows"])+1 or len(matrix[0])!=len(oracle["order"]):
  raise SystemExit("WRONG_ORACLE_DIMENSIONS "+case)
 if not all(len(row)==len(matrix[0]) for row in matrix):
  raise SystemExit("NON_RECTANGULAR_ORACLE "+case)
 if len(source)!=(len(matrix)-1)*len(matrix[0]):
  raise SystemExit("SOURCE_REFERENCE_COUNT_MISMATCH "+case)
 for index,ref in enumerate(source):
  row=1+index//len(matrix[0])
  col=index%len(matrix[0])
  if ref["row_id"]!=oracle["rows"][row-1]["row_id"] or (
     ref["field"]!=oracle["order"][col] or ref["token"]!=matrix[row][col] or
     ref["csv_row"]!=row+1 or ref["csv_column"]!=col+1 or ref["sheet"]!="Synthetic"):
   raise SystemExit("BAD_SOURCE_PROVENANCE "+case)
 sourceRefs+=len(source)
 delim=[";",",","\t"][n%3]
 with (directory/"source.csv").open("r",encoding="utf-8-sig",newline="") as f:
  data=list(csv.reader(f,delimiter=delim))
 if data!=matrix:raise SystemExit("CSV_ORACLE_MISMATCH "+case)
 with Image.open(directory/"source.png") as png:
  png.verify()
 with Image.open(directory/"source.jpg") as jpg:
  jpg.verify()
 with Image.open(directory/"source.png") as png:
  width,height=png.size
  for ref in source:
   x0,y0,x1,y1=ref["bbox"]
   if min(x0,y0,x1,y1)<0 or x0>=x1 or y0>=y1 or x1>width+1 or y1>height+1:
    raise SystemExit("IMAGE_SOURCE_BOX_OUT_OF_RANGE "+case)
 pdf=PdfReader(str(directory/"source.pdf"))
 if len(pdf.pages)!=1:raise SystemExit("PDF_PAGE_COUNT "+case)
 text=pdf.pages[0].extract_text()
 if "SYNTHETIC QA - "+case not in text:
  raise SystemExit("PDF_TITLE_MISSING "+case)
 for filename in names:
  p=directory/filename
  if p.is_symlink() or not p.is_file():raise SystemExit("MISSING_OR_SYMLINK "+str(p))
  b=p.read_bytes()
  if not b or len(b)>12_000_000:raise SystemExit("BAD_FILE_SIZE "+str(p))
  hashes[case+"/"+filename]=digest(b)
  sourceCount+=1
 family[scenario]+=1
if sourceCount!=300 or len(hashes)!=300 or set(family.values())!={5}:
 raise SystemExit("CORPUS_TOTALS_NOT_MATCHED")
result={
 "schemaVersion":1,
 "source":"independent-v1.3-synthetic-generator-derived",
 "cases":60,"sourceFiles":300,"formats":names,
 "qaCasesPerFamily":dict(sorted(family.items())),
 "sourceReferencesChecked":sourceRefs,
 "csvOracleMatches":60,"pdfVerified":60,"pngDecoded":60,"jpegDecoded":60,
 "xlsxOracleMatches":"verified by node build-xlsx.mjs",
 "engineImportRuns":0,"engineQA":"NOT RUN","releaseDecision":"NO-GO",
 "originalQAArchiveSha256":"dfd81ea0eabbbe3785018903909aff42cd6c677e0cdbf01c895f98c393c6b329",
 "originalBinaryIdentityClaim":False,
 "fileHashes":dict(sorted(hashes.items()))
}
(OUTPUT/"corpus-validation.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
print("QA_CORPUS_VERIFIED",json.dumps({k:result[k] for k in [
 "cases","sourceFiles","sourceReferencesChecked","csvOracleMatches","pdfVerified",
 "pngDecoded","jpegDecoded","engineImportRuns","engineQA"]}))

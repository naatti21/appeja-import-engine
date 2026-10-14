"""Byte-for-byte compare two freshly generated corpora.

Never compare ZIP bytes or original external artifact bytes here: only independent
runs of THIS generator with the same environment are required to match.
"""
import hashlib
import json
import sys
from pathlib import Path
if len(sys.argv)!=3:raise SystemExit("usage: check-determinism.py <run-a> <run-b>")
a,b=map(lambda x:Path(x).resolve(),sys.argv[1:])
def walk(root):
 if not root.is_dir():raise SystemExit("MISSING_CORPUS "+str(root))
 files={}
 for p in root.rglob("*"):
  if p.is_symlink():raise SystemExit("SYMLINK_NOT_PERMITTED "+str(p))
  if p.is_file():
   rel=p.relative_to(root).as_posix()
   files[rel]=hashlib.sha256(p.read_bytes()).hexdigest()
 return files
first,second=walk(a),walk(b)
if first!=second:
 differences=[k for k in sorted(set(first)|set(second)) if first.get(k)!=second.get(k)]
 print("NON_DETERMINISTIC_FILES",json.dumps(differences[:50]))
 raise SystemExit(1)
expected=60*7+1 # 5 sources + oracle and references for each, plus manifest
if len(first)!=expected:raise SystemExit("INCORRECT_CORPUS_FILE_COUNT "+str(len(first)))
print("QA_CORPUS_DETERMINISM "+json.dumps({
 "fileCount":len(first),"matchedSha256":len(first),
 "identicalRerun":True,"externalArchiveBitwiseCompared":False
}))

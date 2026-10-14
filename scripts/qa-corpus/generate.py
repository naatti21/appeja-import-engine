"""Reproducible source corpus derived from the independent v1.3 QA generator.

All instruments, accounts and quantities are invented. Oracles precede document bytes.
No application/parser calls occur in this generator.
"""
import csv
import hashlib
import json
import os
import random
from pathlib import Path
from decimal import Decimal
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
OUT = Path(os.environ.get("QA_CORPUS_DIR", "qa-output/corpus")).resolve()
if OUT == ROOT or OUT == Path.cwd() or str(OUT) == "/":
    raise SystemExit("INVALID_CORPUS_OUTPUT")
OUT.mkdir(parents=True, exist_ok=True)

scenarios = [
    "clean", "missing_cost", "missing_currency", "conflicting_value",
    "ambiguous_decimal", "malformed_number", "zero_quantity",
    "separate_accounts", "repeated_holding", "duplicate_column",
    "unknown_money", "missing_quantity"
]
labels = {
 "fi": ["Rivi","Tili","Nimi","Valuutta","Määrä","Nykykurssi","Nykyarvo","Hankintahinta"],
 "en": ["Row","Account","Name","Currency","Quantity","Current price","Market value","Purchase price"],
 "sv": ["Rad","Konto","Namn","Valuta","Antal","Aktuell kurs","Marknadsvärde","Inköpspris"]
}
keys = ["row_id","account","name","currency","quantity","current_price","current_value","purchase_price"]
fontpaths = [
 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
 "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
 "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
]
for font in fontpaths:
    if not Path(font).is_file():
        raise SystemExit(f"MISSING_PINNED_FONT {font}")

manifest = []
for n in range(60):
    seed = 130000 + n
    rng = random.Random(seed)
    scenario = scenarios[n % 12]
    lang = ["fi", "en", "sv"][n % 3]
    case_id = f"S{seed}-{scenario}"
    folder = OUT / case_id
    if folder.exists() and any(folder.iterdir()):
        raise SystemExit(f"OUTPUT_ALREADY_EXISTS {folder} (clear output directory first)")
    folder.mkdir(exist_ok=True)
    rows = []
    for j in range(3 + rng.randrange(3)):
        q = Decimal(rng.randrange(1, 20000)) / 100
        p = Decimal(rng.randrange(101, 60000)) / 100
        cost = Decimal(rng.randrange(101, 50000)) / 100
        rows.append(dict(
            row_id=f"R{j+1}", account=f"SYN-{j%2+1}",
            name=f"Synthetic Asset {j+1}",
            currency=rng.choice(["EUR","USD","SEK","GBP","JPY"]),
            quantity=str(q), current_price=str(p),
            current_value=str((q*p).quantize(Decimal(".01"))),
            purchase_price=str(cost)
        ))
    if scenario in ["separate_accounts", "repeated_holding"]:
        rows[1] = dict(rows[0], row_id="R2",
          account="SYN-2" if scenario == "separate_accounts" else rows[0]["account"])
    if scenario == "zero_quantity":
        rows[0]["quantity"] = "0"
        rows[0]["current_value"] = "0.00"
    block = scenario in [
      "missing_currency","conflicting_value","ambiguous_decimal",
      "malformed_number","duplicate_column","unknown_money","missing_quantity"
    ]
    expected = json.loads(json.dumps(rows))
    rendered = json.loads(json.dumps(rows))
    if scenario == "missing_cost":
        expected[0]["purchase_price"] = None
        rendered[0]["purchase_price"] = ""
    if scenario == "missing_currency":
        expected[0]["currency"] = None
        rendered[0]["currency"] = ""
    if scenario == "missing_quantity":
        expected[0]["quantity"] = None
        rendered[0]["quantity"] = ""
    if scenario == "conflicting_value":
        rendered[0]["current_value"] = str(Decimal(rows[0]["current_value"]) + 17)
        expected[0]["current_value"] = None
    if scenario == "ambiguous_decimal":
        rendered[0]["current_price"] = "1,234"
        expected[0]["current_price"] = None
    if scenario == "malformed_number":
        rendered[0]["quantity"] = "12..34"
        expected[0]["quantity"] = None
    order = list(keys)
    rng.shuffle(order)
    headers = [labels[lang][keys.index(k)] for k in order]
    if scenario == "duplicate_column":
        order += ["current_price"]
        headers += [labels[lang][5]]
    if scenario == "unknown_money":
        order += ["unknown_money"]
        headers += ["Unmapped money"]
    def fmt(k,v):
        if k not in keys[4:] or v == "" or (
            scenario == "ambiguous_decimal" and v == "1,234"
        ) or v == "12..34":
            return v
        formatted = f"{Decimal(v):,.2f}"
        return formatted if lang == "en" else formatted.replace(",","\u202f").replace(".",",")
    matrix = [headers]
    for i,row in enumerate(rendered):
        line = [fmt(k,row.get(k,"99.99")) for k in order]
        if scenario == "duplicate_column" and i == 0:
            line[-1] = "999.99"
            expected[0]["current_price"] = None
        matrix.append(line)
    oracle = dict(
      case_id=case_id,seed=seed,scenario=scenario,language=lang,
      rows=expected,must_block_auto_accept=block,order=order,matrix=matrix,
      policy="Unknown/conflicting values require review; never auto-accept. Identical rows must retain source coverage; accounts remain distinct."
    )
    # Oracle must be persisted BEFORE creating any source file.
    (folder/"oracle.json").write_text(json.dumps(oracle,ensure_ascii=False,indent=2))
    delim=[";",",","\t"][n%3]
    with (folder/"source.csv").open("w",encoding="utf-8-sig" if n%2 else "utf-8",newline="") as f:
        csv.writer(f,delimiter=delim,
          quoting=csv.QUOTE_ALL if n%2 else csv.QUOTE_MINIMAL).writerows(matrix)
    font = ImageFont.truetype(fontpaths[n%3],18)
    width=2300
    height=110+len(matrix)*55
    dark=n%2==1
    bg="#17212b" if dark else "#ffffff"
    fg="#eeeeee" if dark else "#111111"
    img=Image.new("RGB",(width,height),bg)
    draw=ImageDraw.Draw(img)
    draw.text((20,15),"SYNTHETIC QA - "+case_id,fill=fg,font=font)
    refs=[]
    for ri,line in enumerate(matrix):
        for ci,value in enumerate(line):
            x=20+ci*250
            y=70+ri*55
            draw.text((x,y),value,fill=fg,font=font)
            if ri:
                refs.append(dict(
                  row_id=expected[ri-1]["row_id"],field=order[ci],
                  token=value,pdf_token=value.replace("\u202f"," "),
                  csv_row=ri+1,csv_column=ci+1,sheet="Synthetic",
                  cell=f"{chr(65+ci)}{ri+1}",bbox=[x,y,x+240,y+35],
                  pdf_page=1,pdf_bbox=[
                    x,height-70-ri*55-5,x+240,height-70-ri*55+20
                  ]
                ))
    scale=[1,.65,.45,1.2,.8][n//12]
    img=img.resize((round(width*scale),round(height*scale)))
    for ref in refs:
        ref["bbox"]=[round(v*scale) for v in ref["bbox"]]
    if n>=48:
        img=img.filter(ImageFilter.GaussianBlur(.6))
    img.save(folder/"source.png")
    img.save(folder/"source.jpg",quality=[95,75,45,90,60][n//12])
    # invariant=1 eliminates runtime timestamps/IDs from PDF metadata.
    pdf=canvas.Canvas(str(folder/"source.pdf"),pagesize=(width,height),invariant=1)
    pdf.setFont("Helvetica",16)
    pdf.drawString(20,height-30,"SYNTHETIC QA - "+case_id)
    for ri,line in enumerate(matrix):
        for ci,value in enumerate(line):
            pdf.drawString(20+ci*250,height-70-ri*55,value.replace("\u202f"," "))
    pdf.save()
    (folder/"sources.json").write_text(json.dumps(refs,ensure_ascii=False,indent=2))
    manifest.append(dict(
      case_id=case_id,seed=seed,scenario=scenario,
      oracle=f"{case_id}/oracle.json",
      formats=["png","jpg","pdf","csv","xlsx"],status="NOT_RUN"
    ))
(OUT/"manifest.json").write_text(json.dumps(manifest,indent=2))
print("QA_CORPUS_GENERATED",json.dumps({
    "cases":len(manifest),"seedStart":130000,"seedEnd":130059,
    "expectedFormats":5,"filesPendingXlsx":len(manifest)*4,
    "qaStatus":"NOT_RUN","output":str(OUT)
}))

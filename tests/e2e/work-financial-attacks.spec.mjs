import {test,expect} from '@playwright/test';

/**
 * Entirely invented financial screenshot. Pixel→Tesseract→TSV evidence
 * is real; signed / ambiguous source quantities must fail closed.
 */
for (const qty of ['12 kpl','-12 kpl','12 kpl 1,234 kpl']) test(
  'independent Work P1 source amount image quantity '+qty,
  async({page,context})=>{
    test.skip(process.env.REAL_OCR_QA!=='1','Local OCR assets required');
    test.setTimeout(240000);
    const external=[];
    await context.route('**/*',route=>{
      const host=new URL(route.request().url()).hostname;
      if(!['localhost','127.0.0.1'].includes(host)){
        external.push(host);return route.abort();
      }
      return route.continue();
    });
    await page.goto('/demo/structure-learning.html');
    await page.addScriptTag({url:'/demo/vendor/ocr/tesseract.min.js'});
    const x=await page.evaluate(async qty=>{
      const canvas=document.createElement('canvas');
      canvas.width=1000;canvas.height=1400;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='white';ctx.fillRect(0,0,1000,1400);
      ctx.fillStyle='black';ctx.font='28px Arial';
      const lines=[
        ['Investments',40,70],
        ['Total value 630,00 EUR',40,110],
        ['Available balance',40,150],
        ['19,00 EUR',40,188],
        ['Stocks',40,245],
        ['Amber Circuit',40,360],['101,00 EUR',650,360],[qty,735,405],
        ['Velvet Meadow',40,580],['203,00 EUR',650,580],['7 kpl',735,625],
        ['Polar Willow',40,800],['307,00 EUR',650,800],['13 kpl',735,845]
      ];
      for(const [text,x,y] of lines)ctx.fillText(text,x,y);
      const {evidenceFromOcrTsv}=await import('/src/import-observations.mjs');
      const {extractVisualPortfolioCorroborated}=await import('/src/portfolio-visual-evidence.mjs');
      const worker=await Tesseract.createWorker('fin+eng',1,{
        workerPath:location.origin+'/demo/vendor/ocr/worker.min.js',
        corePath:location.origin+'/demo/vendor/ocr/core',
        langPath:location.origin+'/demo/vendor/ocr/lang',
        gzip:false,workerBlobURL:false,cacheMethod:'none'
      });
      let a,b;
      try{
        a=(await worker.recognize(canvas,{}, {tsv:true,text:true})).data;
        await worker.reinitialize('eng');
        b=(await worker.recognize(canvas,{}, {tsv:true,text:true})).data;
      }finally{await worker.terminate();}
      const primary=evidenceFromOcrTsv(a.tsv,{imageWidth:1000,imageHeight:1400});
      const witness=evidenceFromOcrTsv(b.tsv,{imageWidth:1000,imageHeight:1400});
      const r=extractVisualPortfolioCorroborated(primary,witness);
      return {rows:r.candidates.map(c=>({name:c.fields.name.value,qty:c.fields.quantity.value,
          cents:c.fields.marketValue.value?.cents??null,canPersist:c.canPersist})),
        unresolved:r.unresolved.map(u=>u.reason),
        reconcile:r.reconciliation.status,canPersist:r.canPersist,
        observedPrimary:a.text,observedWitness:b.text};
    },qty);
    const negative=qty.startsWith('-');
    const duplicate=qty.includes('1,234');
    const bad=negative||duplicate;
    const oracle=[
      {name:'Amber Circuit',qty:12,cents:10100},
      {name:'Velvet Meadow',qty:7,cents:20300},
      {name:'Polar Willow',qty:13,cents:30700}
    ];
    const correct=x.rows.filter(r=>oracle.some(o=>
      o.name===r.name&&o.qty===r.qty&&o.cents===r.cents)).length;
    console.log('WORK_P1_TRUE_OCR '+JSON.stringify({qty,correct,
      wrong:x.rows.length-correct,withheld:3-x.rows.length,
      reconcile:x.reconcile,unresolved:x.unresolved}));
    expect(external).toEqual([]);
    expect(x.observedPrimary).toContain(qty);
    // In the second real language pass Tesseract sometimes reads the first
    // "kpl" as "kp!" while still reading the ambiguous second amount exactly.
    // Preserve this genuine OCR variation, never rewrite it to fake agreement.
    expect(x.observedWitness).toContain(duplicate?'1,234 kpl':qty);
    expect(x.canPersist).toBe(false);
    expect(x.rows.every(r=>!r.canPersist)).toBe(true);
    expect(x.rows.length-correct).toBe(0);
    if(bad){
      expect(x.rows.some(r=>r.name==='Amber Circuit')).toBe(false);
      expect(x.reconcile).toBe('not-evaluable');
      expect(x.unresolved.some(reason=>reason.includes('QUANTITY'))).toBe(true);
    } else {
      expect(correct).toBe(3);
      expect(x.reconcile).toBe('pass');
    }
  }
);

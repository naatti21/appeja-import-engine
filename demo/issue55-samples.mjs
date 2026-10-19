/** Strictly fictional pixel fixtures. This public preview does not accept uploaded financial files. */
import {issue55Fixture} from '../tests/fixtures/issue55-name-role.mjs';

const input=document.getElementById('portfolioFile');
const help=document.getElementById('sampleHelp');
const buttons=[...document.querySelectorAll('[data-sample-mode]')];
const labels={faint:'Haalea nimi',absent:'Nimi puuttuu',clean:'Selkeä vertailukuva'};

async function syntheticPng(mode){
  const f=issue55Fixture({mode});
  const canvas=document.createElement('canvas');
  canvas.width=f.width;canvas.height=f.height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,f.width,f.height);
  ctx.font='24px Arial';
  for(const line of f.drawing){
    ctx.fillStyle=line.color;ctx.fillText(line.text,line.x,line.y);
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('SYNTHETIC_PNG_FAILED');
  return new File([blob],'fiktiivinen-'+mode+'.png',{type:'image/png'});
}

for(const button of buttons)button.addEventListener('click',async event=>{
  if(!event.isTrusted)return;
  const mode=button.dataset.sampleMode;
  if(!['clean','faint','absent'].includes(mode))return;
  buttons.forEach(b=>b.disabled=true);
  try{
    const file=await syntheticPng(mode);
    const transfer=new DataTransfer();transfer.items.add(file);
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    help.textContent=labels[mode]+' valittu. Paina seuraavaksi Lue kuva. Kaikki nimet ja rahasummat ovat keksittyjä.';
    document.getElementById('readPortfolio').focus();
  }catch{
    help.textContent='Esimerkkikuvan valmistelu epäonnistui. Kokeile uudestaan.';
  }finally{buttons.forEach(b=>b.disabled=false);}
});

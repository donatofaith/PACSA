const SIG_BUCKET='teacher-signatures';
const SIG_MAX=2*1024*1024;
const SIG_TYPES=['image/jpeg','image/png','image/webp'];

let currentSignaturePath='';
let signatureCanvas=null;
let signatureCtx=null;
let drawing=false;
let hasDrawing=false;

let pendingSignatureFile=null;
let pendingCleanCanvas=null;
let cleanupTimer=null;

function sigMsg(text,bad=false){
  const el=document.getElementById('signatureMsg');
  if(!el)return;
  el.textContent=text;
  el.className=`msg ${bad?'bad':'ok'}`;
}

async function waitForTeacherProfile(){
  for(let i=0;i<100;i++){
    if(typeof pageState!=='undefined'&&pageState.teacher&&pageState.user)return true;
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('Teacher profile could not be loaded.');
}

async function fetchSignaturePath(){
  const {data,error}=await supabaseClient
    .from('Teachers')
    .select('signature_path')
    .eq('auth_user_id',pageState.user.id)
    .maybeSingle();
  if(error)throw error;
  currentSignaturePath=data?.signature_path||'';
}

async function showTeacherSignature(){
  const img=document.getElementById('signaturePreview');
  if(!img)return;
  await fetchSignaturePath();
  if(!currentSignaturePath){
    img.removeAttribute('src');
    img.classList.add('empty');
    return;
  }
  const {data,error}=await supabaseClient.storage
    .from(SIG_BUCKET)
    .createSignedUrl(currentSignaturePath,3600);
  if(error){
    sigMsg('Could not load saved signature.',true);
    return;
  }
  img.src=(data?.signedUrl||'')+`&v=${Date.now()}`;
  img.classList.remove('empty');
}

function activateSignatureMethod(method){
  const draw=method==='draw';
  document.getElementById('drawSignaturePanel')?.classList.toggle('hidden-signature-method',!draw);
  document.getElementById('uploadSignaturePanel')?.classList.toggle('hidden-signature-method',draw);
  document.getElementById('drawSignatureTab')?.classList.toggle('active',draw);
  document.getElementById('uploadSignatureTab')?.classList.toggle('active',!draw);
}

function setupSignatureCanvas(){
  signatureCanvas=document.getElementById('signatureCanvas');
  if(!signatureCanvas)return;
  signatureCtx=signatureCanvas.getContext('2d',{willReadFrequently:true});
  signatureCtx.lineCap='round';
  signatureCtx.lineJoin='round';
  signatureCtx.strokeStyle='#111827';
  signatureCtx.lineWidth=6;

  const point=e=>{
    const rect=signatureCanvas.getBoundingClientRect();
    const x=e.touches?.[0]?.clientX ?? e.clientX;
    const y=e.touches?.[0]?.clientY ?? e.clientY;
    return {
      x:(x-rect.left)*(signatureCanvas.width/rect.width),
      y:(y-rect.top)*(signatureCanvas.height/rect.height)
    };
  };

  const start=e=>{
    e.preventDefault();
    drawing=true;
    const p=point(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(p.x,p.y);
  };
  const move=e=>{
    if(!drawing)return;
    e.preventDefault();
    const p=point(e);
    signatureCtx.lineTo(p.x,p.y);
    signatureCtx.stroke();
    hasDrawing=true;
  };
  const end=e=>{
    if(!drawing)return;
    e.preventDefault();
    drawing=false;
    signatureCtx.closePath();
  };

  signatureCanvas.addEventListener('pointerdown',start);
  signatureCanvas.addEventListener('pointermove',move);
  window.addEventListener('pointerup',end);
  signatureCanvas.addEventListener('touchstart',start,{passive:false});
  signatureCanvas.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',end,{passive:false});
}

function clearSignatureCanvas(){
  if(!signatureCanvas||!signatureCtx)return;
  signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
  hasDrawing=false;
  sigMsg('');
}

function canvasToBlob(canvas,type='image/png',quality=1){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare signature image.')),type,quality);
  });
}

function canvasToDataUrl(canvas){
  return canvas.toDataURL('image/png');
}

function cropTransparentCanvas(source,padding=20,minAlpha=35){
  const ctx=source.getContext('2d',{willReadFrequently:true});
  const {width,height}=source;
  const data=ctx.getImageData(0,0,width,height).data;
  let minX=width,minY=height,maxX=-1,maxY=-1;

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      if(data[(y*width+x)*4+3]>minAlpha){
        if(x<minX)minX=x;
        if(x>maxX)maxX=x;
        if(y<minY)minY=y;
        if(y>maxY)maxY=y;
      }
    }
  }

  if(maxX<minX||maxY<minY)return null;

  minX=Math.max(0,minX-padding);
  minY=Math.max(0,minY-padding);
  maxX=Math.min(width-1,maxX+padding);
  maxY=Math.min(height-1,maxY+padding);

  const out=document.createElement('canvas');
  out.width=maxX-minX+1;
  out.height=maxY-minY+1;
  out.getContext('2d').drawImage(
    source,
    minX,minY,out.width,out.height,
    0,0,out.width,out.height
  );
  return out;
}

function grayscaleHistogram(data){
  const hist=new Array(256).fill(0);
  let total=0;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]===0)continue;
    const y=Math.round(0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2]);
    hist[y]++;
    total++;
  }
  return {hist,total};
}

function otsuThreshold(data){
  const {hist,total}=grayscaleHistogram(data);
  if(!total)return 128;

  let sum=0;
  for(let i=0;i<256;i++)sum+=i*hist[i];

  let sumB=0,wB=0,maxVariance=-1,threshold=128;
  for(let t=0;t<256;t++){
    wB+=hist[t];
    if(!wB)continue;
    const wF=total-wB;
    if(!wF)break;
    sumB+=t*hist[t];
    const mB=sumB/wB;
    const mF=(sum-sumB)/wF;
    const between=wB*wF*(mB-mF)*(mB-mF);
    if(between>maxVariance){
      maxVariance=between;
      threshold=t;
    }
  }
  return threshold;
}

function estimatePaperColor(data,width,height){
  // Sample borders/corners because these are most likely paper/background.
  const samples=[];
  const push=(x,y)=>{
    const i=(y*width+x)*4;
    if(data[i+3]>0)samples.push([data[i],data[i+1],data[i+2]]);
  };

  const step=Math.max(1,Math.floor(Math.min(width,height)/45));
  for(let x=0;x<width;x+=step){
    push(x,0); push(x,height-1);
    push(x,Math.min(height-1,Math.floor(height*.08)));
    push(x,Math.max(0,Math.floor(height*.92)));
  }
  for(let y=0;y<height;y+=step){
    push(0,y); push(width-1,y);
    push(Math.min(width-1,Math.floor(width*.08)),y);
    push(Math.max(0,Math.floor(width*.92)),y);
  }

  if(!samples.length)return {r:245,g:245,b:245,l:245};

  // Use bright half of border samples to avoid a dark table/book edge skewing paper estimate.
  samples.sort((a,b)=>{
    const la=.2126*a[0]+.7152*a[1]+.0722*a[2];
    const lb=.2126*b[0]+.7152*b[1]+.0722*b[2];
    return lb-la;
  });
  const chosen=samples.slice(0,Math.max(8,Math.ceil(samples.length*.55)));
  const med=channel=>{
    const vals=chosen.map(v=>v[channel]).sort((a,b)=>a-b);
    return vals[Math.floor(vals.length/2)];
  };
  const r=med(0),g=med(1),b=med(2);
  return {r,g,b,l:.2126*r+.7152*g+.0722*b};
}

async function loadImageCanvas(file){
  if(!SIG_TYPES.includes(file.type))throw new Error('Choose a JPG, PNG or WebP image.');
  if(file.size>SIG_MAX)throw new Error('Signature image must be 2 MB or smaller.');

  const bitmap=await createImageBitmap(file);
  const maxSide=1800;
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));

  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));

  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();

  return canvas;
}

async function imageFileToCleanSignature(file,strength=72){
  const source=await loadImageCanvas(file);
  const ctx=source.getContext('2d',{willReadFrequently:true});
  const img=ctx.getImageData(0,0,source.width,source.height);
  const d=img.data;

  const paper=estimatePaperColor(d,source.width,source.height);
  const otsu=otsuThreshold(d);

  // Stronger slider => lower luminance threshold and greater background rejection.
  // Cap the threshold so paper/shadow does not survive as a grey rectangle.
  const slider=Math.max(35,Math.min(95,Number(strength)||72));
  const aggressive=(slider-35)/60;
  const inkThreshold=Math.max(
    58,
    Math.min(154,otsu-(aggressive*34))
  );

  const softBand=Math.max(10,30-(aggressive*14));
  let kept=0;

  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    const lum=.2126*r+.7152*g+.0722*b;

    const dr=r-paper.r,dg=g-paper.g,db=b-paper.b;
    const paperDistance=Math.sqrt(dr*dr+dg*dg+db*db);
    const chroma=Math.max(r,g,b)-Math.min(r,g,b);

    // Signature ink should be sufficiently darker than the estimated paper
    // OR sufficiently different in colour (e.g. dark blue pen).
    const darknessFromPaper=paper.l-lum;
    const darkEnough=lum<inkThreshold;
    const blueInk=(b>r*1.08 && lum<185 && darknessFromPaper>28);
    const clearlyNotPaper=paperDistance>(42+(aggressive*24)) && lum<(190-aggressive*20);

    if(!(darkEnough||blueInk||clearlyNotPaper)){
      d[i+3]=0;
      continue;
    }

    let alpha;
    if(blueInk){
      alpha=Math.min(255,90+darknessFromPaper*3.2);
    }else{
      alpha=Math.min(255,Math.max(0,((inkThreshold+softBand)-lum)/softBand*255));
    }

    // Kill weak remnants from shadows, book texture and compression.
    const minAlpha=70+(aggressive*70);
    if(alpha<minAlpha){
      d[i+3]=0;
      continue;
    }

    // Normalize surviving ink to near-black. This removes colour from the paper/photo.
    const ink=lum<80?10:Math.min(38,Math.round(lum*.18));
    d[i]=ink;
    d[i+1]=ink;
    d[i+2]=ink;
    d[i+3]=Math.round(alpha);
    kept++;
  }

  if(kept<35)throw new Error('The cleaner removed almost everything. Reduce the removal strength or use a clearer photo.');

  ctx.putImageData(img,0,0);

  const cropped=cropTransparentCanvas(source,18,70);
  if(!cropped)throw new Error('PACSA could not detect the signature. Try darker ink or reduce the removal strength.');

  // Reject a near-full-frame result; that usually means background survived.
  const areaRatio=(cropped.width*cropped.height)/(source.width*source.height);
  if(areaRatio>.82 && slider<90){
    // Re-run once stronger automatically.
    return imageFileToCleanSignature(file,Math.min(95,slider+16));
  }

  const out=document.createElement('canvas');
  out.width=900;
  out.height=280;
  const octx=out.getContext('2d');
  const fit=Math.min(830/cropped.width,220/cropped.height,2.2);
  const w=cropped.width*fit;
  const h=cropped.height*fit;
  octx.drawImage(cropped,(out.width-w)/2,(out.height-h)/2,w,h);

  return out;
}

async function refreshCleanedPreview(){
  if(!pendingSignatureFile)return;
  const strength=document.getElementById('signatureCleanupStrength')?.value||72;
  const preview=document.getElementById('cleanedSignaturePreview');

  try{
    sigMsg('Removing paper background...');
    pendingCleanCanvas=await imageFileToCleanSignature(pendingSignatureFile,strength);
    if(preview){
      preview.src=canvasToDataUrl(pendingCleanCanvas);
      preview.classList.remove('empty');
    }
    document.getElementById('cleanedUploadArea')?.classList.remove('hidden-signature-method');
    sigMsg('Preview ready. The checkerboard behind it represents transparency. Adjust strength if any paper remains.');
  }catch(error){
    pendingCleanCanvas=null;
    if(preview){
      preview.removeAttribute('src');
      preview.classList.add('empty');
    }
    sigMsg(error?.message||'Could not clean the signature photo.',true);
  }
}

function clearPendingUpload(){
  pendingSignatureFile=null;
  pendingCleanCanvas=null;
  const input=document.getElementById('signatureInput');
  if(input)input.value='';
  const preview=document.getElementById('cleanedSignaturePreview');
  if(preview){
    preview.removeAttribute('src');
    preview.classList.add('empty');
  }
  document.getElementById('cleanedUploadArea')?.classList.add('hidden-signature-method');
  sigMsg('');
}

async function saveSignatureCanvas(canvas,sourceLabel='Signature'){
  const buttonIds=['saveDrawnSignatureBtn','saveCleanedSignatureBtn','uploadSignatureBtn'];
  const buttons=buttonIds.map(id=>document.getElementById(id)).filter(Boolean);
  const originals=buttons.map(b=>b.textContent);
  buttons.forEach(b=>b.disabled=true);

  try{
    sigMsg('Saving transparent signature...');
    const cropped=cropTransparentCanvas(canvas,16,35)||canvas;
    const blob=await canvasToBlob(cropped,'image/png');

    const path=`${pageState.user.id}/signature-${Date.now()}.png`;
    const previous=currentSignaturePath;

    const {error:uploadError}=await supabaseClient.storage
      .from(SIG_BUCKET)
      .upload(path,blob,{
        upsert:false,
        contentType:'image/png',
        cacheControl:'3600'
      });
    if(uploadError)throw uploadError;

    const {data:updated,error:updateError}=await supabaseClient
      .rpc('pacsa_update_my_teacher_signature',{p_path:path});
    if(updateError)throw updateError;
    if(!updated)throw new Error('Could not save the signature to your teacher profile.');

    currentSignaturePath=path;

    if(previous&&previous!==path){
      await supabaseClient.storage.from(SIG_BUCKET).remove([previous]);
    }

    sigMsg(`${sourceLabel} saved with transparent background. Existing and future report sheets will use it automatically.`);
    await showTeacherSignature();
  }finally{
    buttons.forEach((b,i)=>{
      b.disabled=false;
      b.textContent=originals[i];
    });
  }
}

async function saveDrawnSignature(){
  if(!hasDrawing)return sigMsg('Draw your signature first.',true);
  try{
    await saveSignatureCanvas(signatureCanvas,'Drawn signature');
  }catch(error){
    sigMsg(error?.message||'Could not save drawn signature.',true);
  }
}

async function chooseSignaturePhoto(file){
  pendingSignatureFile=file;
  await refreshCleanedPreview();
}

async function saveCleanedSignature(){
  if(!pendingCleanCanvas)return sigMsg('Choose and clean a signature photo first.',true);
  try{
    await saveSignatureCanvas(pendingCleanCanvas,'Cleaned signature');
    clearPendingUpload();
  }catch(error){
    sigMsg(error?.message||'Could not save cleaned signature.',true);
  }
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await waitForTeacherProfile();
    setupSignatureCanvas();
    await showTeacherSignature();

    const input=document.getElementById('signatureInput');
    const strength=document.getElementById('signatureCleanupStrength');

    document.getElementById('drawSignatureTab')?.addEventListener('click',()=>activateSignatureMethod('draw'));
    document.getElementById('uploadSignatureTab')?.addEventListener('click',()=>activateSignatureMethod('upload'));
    document.getElementById('clearSignatureBtn')?.addEventListener('click',clearSignatureCanvas);
    document.getElementById('saveDrawnSignatureBtn')?.addEventListener('click',saveDrawnSignature);

    document.getElementById('uploadSignatureBtn')?.addEventListener('click',()=>input?.click());
    input?.addEventListener('change',()=>{
      const file=input.files?.[0];
      if(file)chooseSignaturePhoto(file);
    });

    strength?.addEventListener('input',()=>{
      clearTimeout(cleanupTimer);
      cleanupTimer=setTimeout(refreshCleanedPreview,180);
    });

    document.getElementById('saveCleanedSignatureBtn')?.addEventListener('click',saveCleanedSignature);
    document.getElementById('cancelCleanedSignatureBtn')?.addEventListener('click',clearPendingUpload);
  }catch(error){
    sigMsg(error?.message||'Could not prepare signature tools.',true);
  }
});
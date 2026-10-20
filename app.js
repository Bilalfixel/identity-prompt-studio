'use strict';
const $ = (id) => document.getElementById(id);
const refs = [];
let target = null;
let generated = null;
let viewMode = 'json';
let isGenerating = false;
let hostedAIEnabled = false;
const maximumSize = 40 * 1024 * 1024;
const allowed = ['image/jpeg', 'image/png', 'image/webp'];

function status(message, kind='') {
  const node = $('statusMessage'); node.textContent = message; node.className = 'message' + (kind ? ' ' + kind : '');
}
function resetOutput() {
  generated = null;
  $('readyLabel').textContent = 'NOT GENERATED'; $('readyLabel').classList.remove('ready');
  $('outputPlaceholder').hidden = false; $('outputCode').hidden = true;
  $('copyButton').disabled = true; $('downloadButton').disabled = true;
}
function renderRefs() {
  const grid = $('referenceGrid'); grid.replaceChildren();
  for (let i=0; i<4; i++) {
    if (refs[i]) {
      const thumb = document.createElement('div'); thumb.className='thumb';
      const img = document.createElement('img'); img.src=refs[i].dataUrl; img.alt='Identity photo ' + (i+1);
      const num = document.createElement('span'); num.className='num'; num.textContent=String(i+1).padStart(2,'0');
      const del = document.createElement('button'); del.type='button'; del.textContent='×'; del.title='Remove photo '+(i+1); del.setAttribute('aria-label',del.title);
      del.addEventListener('click',()=>{refs.splice(i,1);renderRefs();resetOutput();status('Photo removed.');});
      thumb.append(img,num,del); grid.append(thumb);
    } else {
      const empty = document.createElement('div'); empty.className='empty-thumb'; empty.textContent='+'; grid.append(empty);
    }
  }
  $('refCount').textContent = refs.length + ' / 4';
  $('referenceDrop').style.display = refs.length>=4 ? 'none':'flex';
}
function renderTarget() {
  $('targetEmpty').hidden=!!target;
  $('targetLoaded').hidden=!target;
  if(target){$('targetImage').src=target.dataUrl;$('targetFilename').textContent=target.name+'  ·  '+target.width+' × '+target.height;}
}
async function preparePhoto(file) {
  if(!allowed.includes(file.type)) throw new Error('Please use JPEG, PNG, or WebP files.');
  if(file.size > maximumSize) throw new Error('Please choose photos under 40 MB each.');
  const objectURL=URL.createObjectURL(file);
  try {
    const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(new Error('Cannot read this photo.'));el.src=objectURL;});
    const max=2048, scale=Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
    const width=Math.max(1,Math.round(img.naturalWidth*scale)), height=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Image processing is unavailable.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
    ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,width,height);
    return {dataUrl:canvas.toDataURL('image/jpeg',0.92),name:file.name||'pasted-image.jpg',width,height};
  } finally {URL.revokeObjectURL(objectURL);}
}
async function addReferences(fileList){
  const files=Array.from(fileList||[]);
  if(!files.length)return;
  if(files.length > 4-refs.length){status('Maximum 4 identity photos. Only the first available slots will be used.','error');}
  for(const file of files.slice(0,4-refs.length)){
    try{const p=await preparePhoto(file);refs.push(p);}catch(e){status(e.message,'error');}
  }
  renderRefs();resetOutput();
  if(refs.length && !($('statusMessage').classList.contains('error')))status(refs.length+' identity photo'+(refs.length===1?'':'s')+' loaded.');
}
async function loadTarget(file){
  if(!file)return;
  try{target=await preparePhoto(file);renderTarget();resetOutput();status('Target scene loaded. Its face and body will never define your identity.');}
  catch(e){status(e.message,'error');}
}
function setupDrop(element, callback){
  element.addEventListener('dragenter',e=>{e.preventDefault();element.classList.add('drag-over');});
  element.addEventListener('dragover',e=>{e.preventDefault();element.classList.add('drag-over');});
  element.addEventListener('dragleave',e=>{if(!element.contains(e.relatedTarget))element.classList.remove('drag-over');});
  element.addEventListener('drop',e=>{e.preventDefault();element.classList.remove('drag-over');callback(e.dataTransfer.files);});
}
async function pasteFromClipboard() {
  if(!navigator.clipboard || !navigator.clipboard.read) {
    status('Click the page and press Ctrl+V to paste an image, or use Upload image.','error');return;
  }
  try{
    const items=await navigator.clipboard.read();
    for(const item of items){const type=item.types.find(x=>allowed.includes(x));if(type){const blob=await item.getType(type);await loadTarget(new File([blob],'clipboard-image.'+type.split('/')[1],{type}));return;}}
    status('No supported image was found in your clipboard. Copy an image first.','error');
  }catch(e){status('Clipboard access was blocked. Press Ctrl+V on this page or upload a file.','error');}
}
const LOCKS = [
'SOURCE PHOTOS OVERRIDE EVERYTHING for facial and body identity. Target photo is SCENE ONLY.',
'Preserve exact head/skull structure, facial width and length, forehead, brows, eyes, eyelids, eye spacing, nose bridge and tip, cheeks, lips, chin, jawline, ears, and natural facial asymmetry.',
'Preserve original skin tone and texture, hair and hairline, facial hair, visible marks and real identity features. No smoothing or beautification.',
'Preserve true body shape, width, shoulder structure, waist, limb proportions and any distinctive anatomy that can be confirmed from uploaded identity photos.',
'Never copy the target model\'s face, ethnicity, physique, waist, or other anatomical features. Never blend or average source and target facial features.',
'Follow target image for pose, clothing, props, framing, camera, environment and lighting as closely as possible WITHOUT altering source anatomical proportions.',
'Do not guess unseen body measurements or attributes absent from the source reference photos.',
'Photorealistic, high-fidelity facial identity, consistent geometry, plausible human anatomy and coherent lighting.'
];
const NEGATIVE = 'wrong identity, target subject\'s face, facial blending, identity drift, changed face shape, different eyes, wrong eye spacing, altered nose, altered lips, changed jawline, changed head geometry, new hairline, changed skin tone, skin smoothing, beautification, distorted body shape, thinner waist, altered shoulder width, changed body proportions, excessive retouching, uncanny face, face-swap seams, extra fingers, deformed hands, cartoon, CGI, artificial skin';
function offlineResult(){
  const notes=$('extraInstructions').value.trim();
  const ratio=$('aspectRatio').value;
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const factor=gcd(target.width,target.height);
  const finalRatio=ratio==='auto'?`${target.width/factor}:${target.height/factor}`:ratio;
  const main=[
    'Generate ONE photorealistic image showing the exact real person in IDENTITY REFERENCE IMAGES 1–'+refs.length+'. Recreate the scene depicted in the TARGET IMAGE as closely as feasible.',
    'IDENTITY IS IMMUTABLE: absolutely preserve the source person\'s unique facial geometry, eye spacing, nose, cheekbones, jaw, skull shape, hair, skin tone and texture, body shape, waist, shoulders and other clearly visible traits. Do not make the source look like the target person.',
    'Use the TARGET IMAGE ONLY as a reference for the shot composition, pose, clothing, accessories, setting, camera viewpoint, background, shadows, lighting and color grading.',
    'Keep the exact source person with anatomically coherent adaptations of pose/clothing, natural complexion and skin texture. Do not alter underlying proportions or stylize identity.',
    'Attach all original reference images along with this prompt; they are not embedded in this JSON.',
    'If a body detail cannot be seen in source photos, do not invent a specific measurement or copy it from the target.',
    notes?'Additional direction, only where it does not conflict with the locked identity: '+notes:''
  ].filter(Boolean).join('\n\n');
  return {
    project:'Identity Prompt Studio', prompt_type:'identity_locked_target_recreation',
    analysis_status:'TEMPLATE ONLY — images not visually analyzed. Add an OpenAI API key for real image-aware details.',
    generation_goal:'Place the source identity in a close reconstruction of the target scene without altering source face or body.',
    image_inputs_required:{identity_reference_images:refs.length,identity_image_role:'Images 1–'+refs.length+': sole source of identity and body anatomy',target_image_role:'Last image: SCENE ONLY, never source of identity',important:'Attach identity photos and target photo with this JSON when you submit it to your image generator. The pictures are not inside this JSON.'},
    priority_order:['Identity and true anatomy','Target pose and crop','Target outfit and props','Target lighting and background'],
    identity_lock:{mode:'MAXIMUM',override_allowed:false,rules:LOCKS},
    target_scene_breakdown:'Visual analysis unavailable in offline template mode; refer to attached target photo.',
    output_settings:{aspect_ratio:finalRatio,aspect_ratio_source:ratio==='auto'?'target image':'user selection',target_image_dimensions:{width:target.width,height:target.height},rendering:'photorealistic',identity_consistency:'maximum',image_count:1},
    main_prompt:main,negative_prompt:NEGATIVE,
    final_quality_checks:['Correct source identity','Unchanged facial structure','Unchanged body shape','Target scene and styling reproduced','No face blend or smoothing'],
    disclaimer:'This is a generic image-reference prompt, not an analysis. Identity fidelity depends on the downstream image model, not on wording alone.'
  };
}
function textPromptOf(result){return result.main_prompt+'\n\nSTRICT NEGATIVE PROMPT:\n'+result.negative_prompt+'\n\nIDENTITY LOCK RULES:\n'+result.identity_lock.rules.map((s,i)=>(i+1)+'. '+s).join('\n');}
function renderOutput(){
  const code=$('outputCode');if(!generated)return;
  code.textContent=viewMode==='json'?JSON.stringify(generated,null,2):textPromptOf(generated);
  $('outputPlaceholder').hidden=true;code.hidden=false;
  $('copyKind').textContent=viewMode==='json'?'JSON':'prompt';
  $('jsonTab').classList.toggle('active',viewMode==='json');$('textTab').classList.toggle('active',viewMode==='text');
  $('readyLabel').textContent=generated.analysis_status?'TEMPLATE READY':'AI ANALYZED';$('readyLabel').classList.add('ready');
  $('copyButton').disabled=false;$('downloadButton').disabled=false;
  $('outputBody').scrollTop=0;
}
async function generate(){
  if(isGenerating)return;
  if(!refs.length){status('First add at least one photo of yourself.','error');return;}
  if(!target){status('Add your target image (the scene you want to recreate).','error');return;}
  const key=$('apiKey').value.trim();
  const useAI=Boolean(key||hostedAIEnabled);
  isGenerating=true;$('generateButton').disabled=true;$('generateButtonText').textContent=useAI?'Analyzing source and target photos…':'Building offline template…';
  status(useAI?'Analyzing images with OpenAI. Your references are sent only for this request.':'Creating a generic reference-based JSON without analyzing the uploaded photos.');
  try{
    if(useAI){
      const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity_images:refs.map(x=>x.dataUrl),target_image:target.dataUrl,target_dimensions:{width:target.width,height:target.height},api_key:key,notes:$('extraInstructions').value,aspect_ratio:$('aspectRatio').value})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Unknown API error.');
      generated=body.result;
    } else {generated=offlineResult();}
    renderOutput();status(useAI?'AI visual analysis complete. JSON is ready to copy.':'Template ready. For actual analysis of both images, add an OpenAI API key.','success');
  }catch(e){status(e.message||'Something went wrong.','error');}
  finally{isGenerating=false;$('generateButton').disabled=false;$('generateButtonText').innerHTML='✦ &nbsp; Generate identity-locked JSON';}
}
async function copyOutput(){
  if(!generated)return;const text=viewMode==='json'?JSON.stringify(generated,null,2):textPromptOf(generated);
  try{await navigator.clipboard.writeText(text);status((viewMode==='json'?'JSON':'Text prompt')+' copied to clipboard.','success');}
  catch(e){const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove();status('Copied to clipboard.','success');}
}
function downloadOutput(){
  if(!generated)return;
  const blob=new Blob([JSON.stringify(generated,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='identity-locked-prompt.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('JSON file downloaded.','success');
}
async function detectHostedAI(){
  try {
    const res=await fetch('/api/config', {cache:'no-store'});
    if(!res.ok) return;
    const cfg=await res.json();
    hostedAIEnabled=Boolean(cfg.hosted_ai_enabled);
    if(hostedAIEnabled){
      $('apiKey').placeholder='Server key configured — no need to enter yours';
      $('apiKey').setAttribute('aria-label','Override website OpenAI API key (optional)');
      $('apiHelp').textContent='This site has an AI key configured on the server. Leave this box empty to use it, or enter your own key instead. Photos are sent to the site server and OpenAI for analysis.';
    }
  }catch(_){ /* file:// offline mode */ }
}
function init(){
  renderRefs();renderTarget();
  detectHostedAI();
  $('referenceDrop').addEventListener('click',()=>$('referenceInput').click());
  $('referenceDrop').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('referenceInput').click();}});
  $('targetEmpty').addEventListener('click',()=>$('targetInput').click());
  $('targetEmpty').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('targetInput').click();}});
  $('chooseTarget').addEventListener('click',()=>$('targetInput').click());
  $('pasteTarget').addEventListener('click',pasteFromClipboard);
  $('referenceInput').addEventListener('change',async e=>{await addReferences(e.target.files);e.target.value='';});
  $('targetInput').addEventListener('change',async e=>{await loadTarget(e.target.files[0]);e.target.value='';});
  setupDrop($('identityDrop'),files=>addReferences(files));
  setupDrop($('targetDrop'),files=>loadTarget(files[0]));
  $('removeTarget').addEventListener('click',()=>{target=null;renderTarget();resetOutput();status('Target image removed.');});
  document.addEventListener('paste',async e=>{
    const files=Array.from(e.clipboardData?.items||[]).filter(i=>i.type.startsWith('image/'));
    if(files.length){e.preventDefault();const file=files[0].getAsFile();if(file)await loadTarget(file);}
  });
  $('toggleKey').addEventListener('click',()=>$('apiKey').type=$('apiKey').type==='password'?'text':'password');
  $('generateButton').addEventListener('click',generate);
  $('copyButton').addEventListener('click',copyOutput);
  $('downloadButton').addEventListener('click',downloadOutput);
  $('jsonTab').addEventListener('click',()=>{viewMode='json';if(generated)renderOutput();else{$('jsonTab').classList.add('active');$('textTab').classList.remove('active');}});
  $('textTab').addEventListener('click',()=>{viewMode='text';if(generated)renderOutput();else{$('textTab').classList.add('active');$('jsonTab').classList.remove('active');}});
  $('clearAll').addEventListener('click',()=>{refs.length=0;target=null;$('extraInstructions').value='';$('apiKey').value='';$('aspectRatio').value='auto';renderRefs();renderTarget();resetOutput();status('All images, key and output cleared.');});
}
init();

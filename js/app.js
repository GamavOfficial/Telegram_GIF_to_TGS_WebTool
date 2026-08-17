(function(){
"use strict";
const $=id=>document.getElementById(id);
let file=null,previewURL=null,downloadURL=null;

function status(text,cls){
  $("status").textContent=text;
  $("status").className="status "+(cls||"");
}

$("gifFile").addEventListener("change",function(){
  const f=this.files&&this.files[0];
  if(!f)return;
  if(f.type!=="image/gif"&&!/\.gif$/i.test(f.name)){
    status("Only GIF files are supported.","err");
    this.value="";
    return;
  }
  file=f;
  $("build").disabled=false;
  if(previewURL)URL.revokeObjectURL(previewURL);
  previewURL=URL.createObjectURL(f);
  $("preview").src=previewURL;
  $("preview").classList.remove("hidden");
  $("fileInfo").textContent=f.name+" • "+(f.size/1024).toFixed(1)+" KB • "+(f.type||"image/gif");
  status("GIF selected. Ready to build.","ok");
  $("result").innerHTML="";
});

$("reset").onclick=()=>location.reload();

async function saveTGS(blob){
  /*
   * Telegram TGS is a gzipped JSON document. Use Telegram's TGS MIME type
   * instead of application/gzip; Android file managers can otherwise append
   * ".gz" to the requested ".tgs" filename.
   */
  if(downloadURL)URL.revokeObjectURL(downloadURL);

  const tgsBlob=new Blob([blob],{type:"application/x-tgsticker"});
  downloadURL=URL.createObjectURL(tgsBlob);

  const a=document.createElement("a");
  a.href=downloadURL;
  a.download="telegram-sticker.tgs";
  a.rel="noopener";
  a.style.display="none";
  document.body.appendChild(a);
  a.click();
  a.remove();

  return downloadURL;
}

async function verifyTGS(blob){
  const head=new Uint8Array(await blob.slice(0,2).arrayBuffer());
  if(head[0]!==0x1f || head[1]!==0x8b)
    throw Error("Generated output is not a valid GZIP/TGS container.");

  if(!window.DecompressionStream)
    return;

  const stream=blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const json=await new Response(stream).text();
  const data=JSON.parse(json);

  if(!data || data.w!==512 || data.h!==512)
    throw Error("TGS validation failed: canvas is not 512×512.");
  if(!Array.isArray(data.layers) || !data.layers.length)
    throw Error("TGS validation failed: no Lottie layers.");
  if(data.fr<30 || data.fr>60)
    throw Error("TGS validation failed: FPS must be 30–60.");
  if((data.op-data.ip)/data.fr>3.01)
    throw Error("TGS validation failed: animation exceeds 3 seconds.");
}

$("build").onclick=async()=>{
  if(!file)return;

  const btn=$("build");
  btn.disabled=true;
  $("result").innerHTML='<div class="progress"><i id="bar"></i></div>';
  const bar=$("bar");

  try{
    const size=+$("size").value;
    const fps=Math.min(60,+$("fps").value);
    const maxFrames=Math.min(180,+$("frames").value);
    const detail=+$("detail").value;

    status("Reading GIF…");
    const gif=GIFParser.parse(await file.arrayBuffer());

    const originalDuration=gif.frames.reduce((s,f)=>s+f.delay,0);
    if(originalDuration>3000)
      status("GIF is longer than 3 seconds; sampling first 3 seconds for TGS.","warn");

    const frames=TGS.composite(gif,maxFrames,size,fps,p=>{
      if(bar)bar.style.width=p+"%";
    });

    status("Building Lottie vector animation…");
    const lottie=TGS.build(frames,size,fps,detail,p=>{
      if(bar)bar.style.width=p+"%";
    });

    status("Creating compressed .TGS…");
    const blob=await TGS.gzip(lottie);
    await verifyTGS(blob);
    const kb=blob.size/1024;

    if(kb>64){
      $("result").innerHTML=
        '<div class="warn"><b>Generated TGS:</b> '+kb.toFixed(1)+' KB</div>'+
        '<div class="status warn">This is above Telegram\'s 64 KB TGS limit. Reduce Detail or Max frames.</div>';
      status("TGS generated, but it is too large.","warn");
      return;
    }

    const url=await saveTGS(blob);

    $("result").innerHTML=
      '<div class="ok"><b>TGS created:</b> '+kb.toFixed(1)+' KB</div>'+
      '<a id="downloadAgain" class="download" href="'+url+'" download="telegram-sticker.tgs">DOWNLOAD .TGS AGAIN</a>'+
      '<div class="status ok">Filename: telegram-sticker.tgs</div>';

    status("TGS created and download started.","ok");
  }catch(e){
    console.error(e);
    $("result").innerHTML="";
    status("Build failed: "+e.message,"err");
  }finally{
    btn.disabled=false;
  }
};
})();

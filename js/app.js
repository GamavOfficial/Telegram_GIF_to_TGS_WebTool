(function(){
"use strict";
const $=id=>document.getElementById(id);
let file=null,previewURL=null;
function status(t,c){$("status").textContent=t;$("status").className="status "+(c||"")}
$("gifFile").addEventListener("change",function(){
  const f=this.files&&this.files[0]; if(!f)return;
  if(f.type!=="image/gif"&&!/\.gif$/i.test(f.name)){status("Only GIF files are supported.","err");this.value="";return}
  file=f;$("build").disabled=false;
  if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(f);
  $("preview").src=previewURL;$("preview").classList.remove("hidden");
  $("fileInfo").textContent=f.name+" • "+(f.size/1024).toFixed(1)+" KB • "+(f.type||"image/gif");
  status("GIF selected. Ready to build.","ok");$("result").innerHTML="";
});
$("reset").onclick=()=>location.reload();
$("build").onclick=async()=>{
 if(!file)return;
 const btn=$("build");btn.disabled=true;$("result").innerHTML='<div class="progress"><i id="bar"></i></div>';
 const bar=$("bar");
 try{
   const size=+$("size").value,fps=+$("fps").value,max=+$("frames").value,detail=+$("detail").value;
   status("Reading GIF…");
   const gif=GIFParser.parse(await file.arrayBuffer());
   status("Decoded "+gif.frames.length+" GIF frame(s). Sampling…");
   const frames=TGS.composite(gif,max,size,fps,p=>{if(bar)bar.style.width=p+"%"});
   status("Building Lottie vector animation…");
   const lottie=TGS.build(frames,size,fps,detail,p=>{if(bar)bar.style.width=(70+p*.3)+"%"});
   status("Creating .TGS gzip package…");
   const blob=await TGS.gzip(lottie),url=URL.createObjectURL(blob),kb=blob.size/1024;
   $("result").innerHTML='<div class="'+(kb<=64?"ok":"warn")+'"><b>TGS created:</b> '+kb.toFixed(1)+' KB</div>'+
     '<a class="download" download="telegram-sticker.tgs" href="'+url+'">DOWNLOAD .TGS</a>'+
     (kb>64?'<div class="status warn">Over 64 KB. Reduce Detail/Max frames or use a simpler GIF.</div>':'');
   status("TGS created successfully.","ok");
 }catch(e){console.error(e);status("Build failed: "+e.message,"err");$("result").innerHTML=""}
 finally{btn.disabled=false}
};
})();

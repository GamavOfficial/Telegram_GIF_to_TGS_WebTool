(function(){
"use strict";
const $=id=>document.getElementById(id);let file=null,url=null;
function msg(t,c=""){$("status").textContent=t;$("status").className="status "+c}
$("gifFile").addEventListener("change",e=>{
 const f=e.target.files?.[0];if(!f)return;
 if(!/\.gif$/i.test(f.name)){msg("Please choose a GIF file.","err");return}
 file=f;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);
 $("preview").src=url;$("previewWrap").classList.remove("hidden");$("build").disabled=false;
 $("fileInfo").textContent=f.name+" • "+(f.size/1024).toFixed(1)+" KB • GIF";
 msg("GIF selected successfully. TGS engine is ready.","ok");
});
$("reset").onclick=()=>location.reload();
$("build").onclick=async()=>{
 if(!file)return;$("build").disabled=true;$("result").innerHTML='<div class="progress"><i id="bar"></i></div>';
 try{
  const size=+$("size").value,fps=60,max=+$("frames").value,detail=+$("detail").value;
  msg("Reading GIF…");const gif=GIFParser.parse(await file.arrayBuffer());
  msg("Sampling GIF frames…");
  const frames=TGS.sample(gif,max,size,fps,p=>$("bar").style.width=p+"%");
  msg("Building compact Lottie vector animation…","ok");
  const lottie=TGS.build(frames,size,fps,detail,p=>$("bar").style.width=(55+p*.35)+"%");
  msg("Compressing and validating TGS…");
  const blob=await TGS.gzip(lottie);await TGS.inspect(blob);
  const tgs=new Blob([blob],{type:"application/x-tgsticker"}),u=URL.createObjectURL(tgs);
  const a=document.createElement("a");a.href=u;a.download="telegram-sticker.tgs";a.style.display="none";document.body.appendChild(a);a.click();a.remove();
  $("result").innerHTML='<div class="ok"><b>Valid TGS generated:</b> '+(blob.size/1024).toFixed(1)+' KB</div><a class="download" href="'+u+'" download="telegram-sticker.tgs">DOWNLOAD .TGS AGAIN</a>';
  msg("TGS created and validated successfully.","ok");
 }catch(e){console.error(e);$("result").innerHTML="";msg("Build failed: "+e.message,"err")}
 finally{$("build").disabled=false}
};
})();

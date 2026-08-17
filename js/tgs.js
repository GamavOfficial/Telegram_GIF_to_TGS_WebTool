/* Compact Lottie/TGS encoder. */
(function(){
"use strict";

function sample(gif,count,size,fps,progress){
 const src=document.createElement("canvas"),ctx=src.getContext("2d",{willReadFrequently:true});
 src.width=gif.width;src.height=gif.height;ctx.clearRect(0,0,src.width,src.height);
 const total=Math.min(3000,gif.frames.reduce((s,f)=>s+f.delay,0));
 const frames=Math.min(count,Math.max(2,Math.floor(total/1000*fps)));
 const step=total/frames, out=[];let fi=0,elapsed=0;
 for(let n=0;n<frames;n++){
   const target=n*step;
   while(fi<gif.frames.length&&elapsed<=target){
     const f=gif.frames[fi];
     ctx.putImageData(new ImageData(f.rgba,f.width,f.height),f.left,f.top);
     elapsed+=f.delay;fi++;
   }
   const c=document.createElement("canvas");c.width=size;c.height=size;
   const x=c.getContext("2d",{willReadFrequently:true});
   const sc=Math.min(size/src.width,size/src.height),dw=src.width*sc,dh=src.height*sc;
   x.clearRect(0,0,size,size);x.drawImage(src,(size-dw)/2,(size-dh)/2,dw,dh);
   out.push(x.getImageData(0,0,size,size));progress&&progress(n/frames*55);
 }
 return out;
}

function color(img,x0,y0,x1,y1){
 let r=0,g=0,b=0,a=0,n=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){let p=(y*img.width+x)*4,A=img.data[p+3]/255;r+=img.data[p]*A;g+=img.data[p+1]*A;b+=img.data[p+2]*A;a+=A;n++}
 if(a<.001)return{rgb:[0,0,0],alpha:0};
 return{rgb:[r/a/255,g/a/255,b/a/255],alpha:Math.min(1,a/n)};
}
function kf(vals){
 if(vals.length===1)return{a:0,k:vals[0]};
 return{a:1,k:vals.map((v,i)=>({t:i,s:v,e:vals[Math.min(i+1,vals.length-1)],o:{x:[0.333],y:[0]},i:{x:[0.667],y:[1]}}))};
}
function build(frames,size,fps,detail,progress){
 const grid=detail, W=512,H=512,layers=[],cw=size/grid,ch=size/grid;
 for(let gy=0;gy<grid;gy++)for(let gx=0;gx<grid;gx++){
   let colors=[],alphas=[];
   for(const img of frames){let c=color(img,Math.floor(gx*cw),Math.floor(gy*ch),Math.min(size,Math.floor((gx+1)*cw)),Math.min(size,Math.floor((gy+1)*ch)));colors.push(c.rgb);alphas.push(c.alpha*100)}
   const x=(gx+.5)*cw*W/size,y=H-(gy+.5)*ch*H/size,w=cw*W/size,h=ch*H/size;
   layers.push({
    ddd:0,ind:layers.length+1,ty:4,nm:"cell_"+(layers.length+1),sr:1,ip:0,op:frames.length,st:0,bm:0,
    ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[x,y,0]},a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},
    shapes:[
      {ty:"rc",d:1,s:{a:0,k:[w,h]},p:{a:0,k:[0,0]},r:{a:0,k:0}},
      {ty:"fl",c:kf(colors),o:kf(alphas),r:1}
    ]
   });
 }
 return{v:"5.7.4",fr:fps,ip:0,op:frames.length,w:W,h:H,nm:"TGS Sticker",ddd:0,assets:[],layers};
}
async function gzip(json){
 if(!window.CompressionStream)throw Error("This Chrome version has no GZIP support.");
 const bytes=new TextEncoder().encode(JSON.stringify(json));
 return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
}
async function inspect(blob){
 if(blob.size>65536)throw Error("TGS is "+(blob.size/1024).toFixed(1)+" KB; Telegram limit is 64 KB.");
 const u=new Uint8Array(await blob.slice(0,2).arrayBuffer());if(u[0]!==31||u[1]!==139)throw Error("Output is not a GZIP container.");
 const json=await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).json();
 if(json.w!==512||json.h!==512||json.fr!==60||json.layers.length===0)throw Error("Telegram TGS structure validation failed.");
 if(json.op>180)throw Error("Animation exceeds 3 seconds.");
 return json;
}
window.TGS={sample,build,gzip,inspect};
})();

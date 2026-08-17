/* GIF compositing + Lottie/TGS builder. */
(function(){
"use strict";

function composite(gif,maxFrames,size,fps,onProgress){
  const src=document.createElement("canvas"),ctx=src.getContext("2d",{willReadFrequently:true});
  src.width=gif.width;src.height=gif.height;ctx.clearRect(0,0,src.width,src.height);
  let total=0;for(const f of gif.frames)total+=f.delay;
  const maxDuration=3000;
  total=Math.min(total,maxDuration);
  const count=Math.min(maxFrames,Math.max(1,Math.min(Math.floor(total/1000*fps),Math.floor(3*fps))));
  const step=total/count;
  let fi=0,elapsed=0,previous=null,out=[];
  function draw(f){ctx.putImageData(new ImageData(f.rgba,f.width,f.height),f.left,f.top)}
  for(let s=0;s<count;s++){
    const target=s*step;
    while(fi<gif.frames.length&&elapsed<=target){
      const f=gif.frames[fi];
      if(f.disposal===3)previous=ctx.getImageData(0,0,src.width,src.height);
      draw(f);elapsed+=f.delay;
      if(elapsed<=target){
        if(f.disposal===2)ctx.clearRect(f.left,f.top,f.width,f.height);
        else if(f.disposal===3&&previous)ctx.putImageData(previous,0,0);
      }
      fi++;
    }
    const c=document.createElement("canvas");c.width=size;c.height=size;
    const x=c.getContext("2d",{willReadFrequently:true});
    x.clearRect(0,0,size,size);
    const scale=Math.min(size/src.width,size/src.height),dw=src.width*scale,dh=src.height*scale;
    x.drawImage(src,(size-dw)/2,(size-dh)/2,dw,dh);
    out.push(x.getImageData(0,0,size,size));
    if(onProgress)onProgress((s+1)/count*65);
  }
  return out;
}

function build(frames,size,fps,detail,onProgress){
  /* TGS canvas is fixed to Telegram's 512×512 coordinate space. */
  const W=512,H=512,cell=Math.max(1,Math.ceil(size/detail)),sx=W/size,sy=H/size,layers=[];
  let ind=1;

  for(let y=0;y<size;y+=cell){
    for(let x=0;x<size;x+=cell){
      const op=[],col=[];
      for(let f=0;f<frames.length;f++){
        const img=frames[f];let r=0,g=0,b=0,a=0,n=0;
        for(let yy=y;yy<Math.min(size,y+cell);yy++){
          for(let xx=x;xx<Math.min(size,x+cell);xx++){
            const p=(yy*size+xx)*4;
            r+=img.data[p];g+=img.data[p+1];b+=img.data[p+2];a+=img.data[p+3];n++;
          }
        }
        r/=n;g/=n;b/=n;a/=n;
        op.push({t:f,s:[Math.round(a/255*100)]});
        col.push([r/255,g/255,b/255,a/255]);
      }

      const last=col[col.length-1]||[1,1,1,0];
      const px=(x+cell/2)*sx,py=H-(y+cell/2)*sy;
      const rw=cell*sx,rh=cell*sy;

      layers.push({
        ddd:0,ind:ind++,ty:4,nm:"cell_"+ind,sr:1,ip:0,op:frames.length,st:0,bm:0,
        ks:{
          o:{a:1,k:op},
          r:{a:0,k:0},
          p:{a:0,k:[px,py,0]},
          a:{a:0,k:[0,0,0]},
          s:{a:0,k:[100,100,100]}
        },
        shapes:[
          {ty:"rc",d:1,s:{a:0,k:[rw,rh]},p:{a:0,k:[0,0]},r:{a:0,k:0}},
          {ty:"fl",c:{a:0,k:last},o:{a:0,k:100},r:1}
        ]
      });
    }
    if(onProgress)onProgress(65+(y/size)*30);
  }

  return {
    v:"5.7.4",fr:fps,ip:0,op:frames.length,w:W,h:H,nm:"Telegram TGS",
    ddd:0,assets:[],layers:layers
  };
}

async function gzip(obj){
  if(!window.CompressionStream)throw Error("GZIP is not supported by this browser. Use current Chrome.");
  const bytes=new TextEncoder().encode(JSON.stringify(obj));
  const stream=new Blob([bytes],{type:"application/json"}).stream()
    .pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).blob();
}

window.TGS={composite,build,gzip};
})();

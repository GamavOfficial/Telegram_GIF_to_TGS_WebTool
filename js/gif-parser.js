/* Self-contained GIF87a/GIF89a parser + LZW decoder. */
(function(){
"use strict";
function u16(a,p){return a[p]|(a[p+1]<<8)}
function readTable(a,p,n){
  const t=new Array(n);
  for(let i=0;i<n;i++) t[i]=[a[p++],a[p++],a[p++]];
  return [t,p];
}
function deinterlace(src,w,h){
  const out=new Uint8Array(src.length), starts=[0,4,2,1], steps=[8,8,4,2], row=w;
  let s=0;
  for(let pass=0;pass<4;pass++) for(let y=starts[pass];y<h;y+=steps[pass]){
    out.set(src.subarray(s,s+row),y*row); s+=row;
  }
  return out;
}
function lzw(data,min,size){
  const clear=1<<min,end=clear+1;
  let codeSize=min+1,next=clear+2,bits=0,old=-1,first=0,out=new Uint8Array(size),op=0;
  const pre=new Int16Array(4096),suf=new Uint8Array(4096),stack=new Uint8Array(4096);
  function code(){
    let c=0;
    for(let b=0;b<codeSize;b++){
      const k=bits>>3;
      if(k>=data.length)return null;
      c|=((data[k]>>(bits&7))&1)<<b; bits++;
    }
    return c;
  }
  for(let i=0;i<clear;i++){pre[i]=-1;suf[i]=i}
  while(op<size){
    let c=code(); if(c===null||c===end)break;
    if(c===clear){codeSize=min+1;next=clear+2;old=-1;continue}
    if(old<0){if(c>=clear)break;out[op++]=suf[c];first=suf[c];old=c;continue}
    let inCode=c,sp=0;
    if(c>=next){stack[sp++]=first;c=old}
    while(c>=clear&&sp<4096){stack[sp++]=suf[c];c=pre[c]}
    if(c<0||c>=clear)break;
    first=suf[c];stack[sp++]=first;
    while(sp&&op<size)out[op++]=stack[--sp];
    if(next<4096){pre[next]=old;suf[next]=first;next++;if(next===(1<<codeSize)&&codeSize<12)codeSize++}
    old=inCode;
  }
  return out;
}
function parse(buffer){
  const a=new Uint8Array(buffer), n=a.length;
  if(n<13)throw Error("File is too small to be a GIF.");
  const sig=String.fromCharCode(...a.subarray(0,6));
  if(sig!=="GIF87a"&&sig!=="GIF89a")throw Error("Invalid GIF header.");
  let p=6,w=u16(a,p),h=u16(a,p+2),packed=a[p+4];p+=7;
  const gct=packed&128, gctN=1<<(1+(packed&7)); let globalTable=null;
  if(gct){[globalTable,p]=readTable(a,p,gctN)}
  const frames=[]; let gce={delay:100,transparent:false,transIndex:0,disposal:0};
  function skip(){
    while(p<n){const len=a[p++];if(!len)break;p+=len}
  }
  while(p<n){
    const b=a[p++];
    if(b===0x3b)break;
    if(b===0x21){
      const label=a[p++];
      if(label===0xf9){
        const sz=a[p++],q=p,flags=a[p++],delay=u16(a,p)*10;p+=2;
        const ti=a[p++];p++;gce={delay:Math.max(20,delay||100),transparent:!!(flags&1),transIndex:ti,disposal:(flags>>2)&7};
        p=q+sz+1;
      }else skip();
      continue;
    }
    if(b!==0x2c)throw Error("Unsupported GIF block at byte "+(p-1)+".");
    const left=u16(a,p),top=u16(a,p+2),fw=u16(a,p+4),fh=u16(a,p+6);p+=8;
    const ip=a[p++],lct=ip&128,inter=ip&64,lctN=1<<(1+(ip&7));
    let table=globalTable;if(lct)[table,p]=readTable(a,p,lctN);
    if(!table)throw Error("GIF frame has no color table.");
    const min=a[p++],chunks=[];let total=0;
    while(p<n){const len=a[p++];if(!len)break;chunks.push(a.slice(p,p+len));total+=len;p+=len}
    const comp=new Uint8Array(total);let cp=0;for(const c of chunks){comp.set(c,cp);cp+=c.length}
    let idx=lzw(comp,min,fw*fh);if(inter)idx=deinterlace(idx,fw,fh);
    const rgba=new Uint8ClampedArray(fw*fh*4);
    for(let i=0;i<fw*fh;i++){const c=table[idx[i]]||[0,0,0],al=(gce.transparent&&idx[i]===gce.transIndex)?0:255;
      rgba[i*4]=c[0];rgba[i*4+1]=c[1];rgba[i*4+2]=c[2];rgba[i*4+3]=al}
    frames.push({left,top,width:fw,height:fh,rgba,delay:gce.delay,disposal:gce.disposal});
  }
  if(!frames.length)throw Error("No GIF frames found.");
  return {width:w,height:h,frames};
}
window.GIFParser={parse};
})();
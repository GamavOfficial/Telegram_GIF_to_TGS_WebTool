/* GIF87a/GIF89a parser + LZW decoder. */
(function(){
"use strict";
function u16(a,p){return a[p]|(a[p+1]<<8)}
function table(a,p,n){let t=new Array(n);for(let i=0;i<n;i++)t[i]=[a[p++],a[p++],a[p++]];return[t,p]}
function deinterlace(src,w,h){let o=new Uint8Array(src.length),starts=[0,4,2,1],steps=[8,8,4,2],s=0;for(let q=0;q<4;q++)for(let y=starts[q];y<h;y+=steps[q]){o.set(src.subarray(s,s+w),y*w);s+=w}return o}
function lzw(d,min,size){
 const clear=1<<min,end=clear+1;let cs=min+1,bits=0,old=-1,next=clear+2,op=0,first=0;
 const out=new Uint8Array(size),pre=new Int16Array(4096),suf=new Uint8Array(4096),stack=new Uint8Array(4096);
 function code(){let c=0;for(let b=0;b<cs;b++){let k=bits>>3;if(k>=d.length)return null;c|=((d[k]>>(bits&7))&1)<<b;bits++}return c}
 while(op<size){let c=code();if(c===null||c===end)break;if(c===clear){cs=min+1;next=clear+2;old=-1;continue}
  if(old<0){if(c>=clear)break;out[op++]=suf[c];first=suf[c];old=c;continue}
  let ic=c,sp=0;if(c>=next){stack[sp++]=first;c=old}
  while(c>=clear&&sp<4096){stack[sp++]=suf[c];c=pre[c]}
  if(c<0||c>=clear)break;first=suf[c];stack[sp++]=first
  while(sp&&op<size)out[op++]=stack[--sp]
  if(next<4096){pre[next]=old;suf[next]=first;next++;if(next===(1<<cs)&&cs<12)cs++}old=ic
 }
 return out
}
function parse(buf){
 const a=new Uint8Array(buf);if(a.length<13)throw Error("File is too small.");
 const sig=String.fromCharCode(...a.subarray(0,6));if(sig!=="GIF87a"&&sig!=="GIF89a")throw Error("Not a GIF file.");
 let p=6,w=u16(a,p),h=u16(a,p+2),pk=a[p+4];p+=7;
 let gt=null;if(pk&128)[gt,p]=table(a,p,1<<(1+(pk&7)));
 const frames=[];let gce={delay:100,transparent:false,ti:0,disposal:0};
 function skip(){while(p<a.length){let n=a[p++];if(!n)break;p+=n}}
 while(p<a.length){let b=a[p++];if(b===0x3b)break;
  if(b===0x21){let lab=a[p++];if(lab===0xf9){let sz=a[p++],q=p,fl=a[p++],delay=u16(a,p)*10;p+=2;let ti=a[p++];p++;gce={delay:Math.max(20,delay||100),transparent:!!(fl&1),ti,disposal:(fl>>2)&7};p=q+sz+1}else skip();continue}
  if(b!==0x2c)throw Error("Unsupported GIF block.");
  let left=u16(a,p),top=u16(a,p+2),fw=u16(a,p+4),fh=u16(a,p+6);p+=8;
  let ip=a[p++],lt=ip&128,inter=ip&64,nt=1<<(1+(ip&7)),colors=gt;if(lt)[colors,p]=table(a,p,nt);if(!colors)throw Error("No color table.");
  let min=a[p++],parts=[],total=0;while(p<a.length){let n=a[p++];if(!n)break;parts.push(a.slice(p,p+n));total+=n;p+=n}
  let comp=new Uint8Array(total),q=0;for(let z of parts){comp.set(z,q);q+=z.length}
  let idx=lzw(comp,min,fw*fh);if(inter)idx=deinterlace(idx,fw,fh);
  let rgba=new Uint8ClampedArray(fw*fh*4);for(let i=0;i<fw*fh;i++){let c=colors[idx[i]]||[0,0,0],al=gce.transparent&&idx[i]===gce.ti?0:255;rgba[i*4]=c[0];rgba[i*4+1]=c[1];rgba[i*4+2]=c[2];rgba[i*4+3]=al}
  frames.push({left,top,width:fw,height:fh,rgba,delay:gce.delay,disposal:gce.disposal})
 }
 if(!frames.length)throw Error("No GIF frames found.");return{width:w,height:h,frames}
}
window.GIFParser={parse};
})();

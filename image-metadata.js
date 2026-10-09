// Inspect dimensions before asking Safari to allocate a decoded camera photograph.
(function(root){
'use strict';
const LIMIT=13000000;
function dimensions(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),length=bytes.length;
 const text=(start,count)=>String.fromCharCode(...bytes.slice(start,start+count));
 if(length>=24&&bytes[0]===137&&text(1,3)==='PNG'&&text(12,4)==='IHDR')return {width:view.getUint32(16),height:view.getUint32(20)};
 if(length>=10&&/^GIF8[79]a$/.test(text(0,6)))return {width:view.getUint16(6,true),height:view.getUint16(8,true)};
 if(length>=4&&bytes[0]===255&&bytes[1]===216){
  let offset=2;
  while(offset+3<length){
   if(bytes[offset++]!==255)return null;
   while(bytes[offset]===255)offset++;
   const marker=bytes[offset++];if(marker===217||marker===218)return null;
   if(marker===1||(marker>=208&&marker<=215))continue;
   if(offset+2>length)return null;
   const size=view.getUint16(offset);if(size<2||offset+size>length)return null;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7)return {width:view.getUint16(offset+5),height:view.getUint16(offset+3)};
   offset+=size;
  }
 }
 if(length>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
  const type=text(12,4);
  if(type==='VP8X')return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(type==='VP8L'&&bytes[20]===47){const bits=view.getUint32(21,true);return {width:1+(bits&16383),height:1+((bits>>>14)&16383)};}
  if(type==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return {width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
 }
 // HEIC/AVIF image properties use ispe boxes, possibly nested under meta/iprp/ipco.
 if(length>=16&&text(4,4)==='ftyp'){
  let largest=null;
  function boxes(start,end,depth){
   if(depth>8)return;
   for(let offset=start;offset+8<=end;){
    const size=view.getUint32(offset),type=text(offset+4,4);if(size<8||offset+size>end)break;
    if(type==='ispe'&&size>=20){const item={width:view.getUint32(offset+12),height:view.getUint32(offset+16)};if(!largest||item.width*item.height>largest.width*largest.height)largest=item;}
    if(['meta','iprp','ipco'].includes(type))boxes(offset+8+(type==='meta'?4:0),offset+size,depth+1);
    offset+=size;
   }
  }
  boxes(0,length,0);return largest;
 }
 return null;
}
async function inspect(file){
 if(file.size>12*1024*1024)throw Error('12MB以下の写真を選んでください。');
 const size=dimensions(await file.slice(0,512*1024).arrayBuffer());
 if(!size||!size.width||!size.height)throw Error('写真のサイズを確認できませんでした。JPEG・PNG・WebP形式の写真を選んでください。');
 if(size.width*size.height>LIMIT||size.width>8192||size.height>8192)throw Error('写真が大きすぎます。縮小した写真かスクリーンショットを選んでください（最大1300万画素）。');
 return size;
}
root.ImageMetadata={dimensions,inspect,limit:LIMIT};
})(typeof window==='undefined'?globalThis:window);

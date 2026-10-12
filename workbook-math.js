// Native MathML for common workbook notation; no network, HTML injection or stored conversion.
(function(root){
'use strict';
function parse(source){
 if(source.length>512)return null;
 const tokens=source.match(/\\frac|\d+(?:\.\d+)?|[A-Za-z]|[()+\-*/^{}=]/g)||[];
 if(tokens.join('')!==source||tokens.length>256)return null;
 let index=0;
 function expression(min=0,depth=0){
  if(depth>32)throw Error('nested');
  let token=tokens[index++],left;
  if(token==='+'||token==='-')left={type:'row',children:[{type:'op',text:token},expression(3,depth+1)]};
  else if(token==='('||token==='{'){left=expression(0,depth+1);if(tokens[index++]!==(token==='('?')':'}'))throw Error('group');if(token==='(')left={type:'row',children:[{type:'op',text:'('},left,{type:'op',text:')'}]};}
  else if(token==='\\frac'){if(tokens[index++]!=='{')throw Error('fraction');const top=expression(0,depth+1);if(tokens[index++]!=='}'||tokens[index++]!=='{')throw Error('fraction');const bottom=expression(0,depth+1);if(tokens[index++]!=='}')throw Error('fraction');left={type:'frac',children:[top,bottom]};}
  else if(/^\d/.test(token||''))left={type:'number',text:token};
  else if(/^[A-Za-z]$/.test(token||''))left={type:'symbol',text:token};
  else throw Error('atom');
  while(index<tokens.length){
   let op=tokens[index],implicit=/^(?:[A-Za-z]|\d|\(|\{|\\frac)/.test(op),power=implicit?2:({'=':0,'+':1,'-':1,'*':2,'/':2,'^':4}[op]);
   if(power===undefined||power<min)break;
   if(!implicit)index++;
   const right=expression(op==='^'?power:power+1,depth+1);
   left=op==='/'?{type:'frac',children:[left,right]}:op==='^'?{type:'power',children:[left,right]}:{type:'row',children:implicit?[left,right]:[left,{type:'op',text:op==='*'?'×':op},right]};
  }return left;
 }
 try{const result=expression();return index===tokens.length?result:null;}catch{return null;}
}
function format(text){
 const fragment=document.createDocumentFragment();let at=0,formatted=false;
 const pattern=/[A-Za-z0-9(\\][A-Za-z0-9()+\-*/^{}=.\\]*/g;
 for(const match of String(text).matchAll(pattern)){
  const source=match[0],ast=/\^|\/|\\frac/.test(source)&&!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(source)?parse(source):null;
  fragment.append(document.createTextNode(String(text).slice(at,match.index)));
  if(ast){const math=document.createElementNS('http://www.w3.org/1998/Math/MathML','math');math.setAttribute('display','inline');math.setAttribute('displaystyle','true');math.setAttribute('alttext',source);math.append(draw(ast));fragment.append(math);formatted=true;}else fragment.append(document.createTextNode(source));at=match.index+source.length;
 }
 fragment.append(document.createTextNode(String(text).slice(at)));return {fragment,formatted};
}
function draw(ast){const tag={number:'mn',symbol:'mi',op:'mo',row:'mrow',frac:'mfrac',power:'msup'}[ast.type],node=document.createElementNS('http://www.w3.org/1998/Math/MathML',tag);if(ast.text)node.textContent=ast.text;else ast.children.forEach(child=>node.append(draw(child)));return node;}
root.WorkbookMath={parse,format};if(typeof module!=='undefined')module.exports={parse};
})(typeof window==='undefined'?globalThis:window);

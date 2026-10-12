// Native MathML for common workbook notation; no network, HTML injection or stored conversion.
(function(root){
'use strict';
function parse(source){
 if(source.length>512)return null;
 source=source.replace(/\s+/g,'').replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/');
 const tokens=source.match(/\\(?:frac|sqrt)|sqrt|cbrt|\d+(?:\.\d+)?|[A-Za-zα-ωΑ-Ωπ∞∫∮∑∏]|[√∛∜()[\]+\-*/^_{}=]/g)||[];
 if(tokens.join('')!==source||tokens.length>256)return null;
 let index=0;
 function expression(min=0,depth=0){
  if(depth>32)throw Error('nested');
  let token=tokens[index++],left;
  if(token==='+'||token==='-')left={type:'row',children:[{type:'op',text:token},expression(3,depth+1)]};
  else if(token==='('||token==='{'){left=expression(0,depth+1);if(tokens[index++]!==(token==='('?')':'}'))throw Error('group');if(token==='(')left={type:'row',children:[{type:'op',text:'('},left,{type:'op',text:')'}]};}
  else if(token==='\\frac'){if(tokens[index++]!=='{')throw Error('fraction');const top=expression(0,depth+1);if(tokens[index++]!=='}'||tokens[index++]!=='{')throw Error('fraction');const bottom=expression(0,depth+1);if(tokens[index++]!=='}')throw Error('fraction');left={type:'frac',children:[top,bottom]};}
  else if(['√','∛','∜','sqrt','cbrt','\\sqrt'].includes(token)){
   let indexNode={type:'number',text:token==='∛'||token==='cbrt'?'3':'4'};
   const indexed=token==='∛'||token==='∜'||token==='cbrt'||tokens[index]==='[';
   if(tokens[index]==='['){index++;indexNode=expression(0,depth+1);if(tokens[index++]!==']')throw Error('root');}
   const value=expression(5,depth+1);left=indexed?{type:'root',children:[value,indexNode]}:{type:'sqrt',children:[value]};
  }
  else if(/^\d/.test(token||''))left={type:'number',text:token};
  else if(/^[A-Za-zα-ωΑ-Ωπ∞∫∮∑∏]$/.test(token||''))left={type:'symbol',text:token};
  else throw Error('atom');
  while(index<tokens.length){
   let op=tokens[index],implicit=/^(?:[A-Za-zα-ωΑ-Ωπ∞∫∮∑∏√∛∜]|\d|\(|\{|\\(?:frac|sqrt))/.test(op),power=implicit?2:({'=':0,'+':1,'-':1,'*':2,'/':2,'^':4,'_':4}[op]);
   if(power===undefined||power<min)break;
   if(!implicit)index++;
   const right=expression(op==='_'?5:op==='^'?power:power+1,depth+1);
   left=op==='/'?{type:'frac',children:[left,right]}:op==='^'?{type:'power',children:[left,right]}:op==='_'?{type:'subscript',children:[left,right]}:{type:'row',children:implicit?[left,right]:[left,{type:'op',text:op==='*'?'×':op},right]};
  }return left;
 }
 try{const result=expression();return index===tokens.length?result:null;}catch{return null;}
}
const symbols={'π':'\\pi','α':'\\alpha','β':'\\beta','γ':'\\gamma','θ':'\\theta','λ':'\\lambda','μ':'\\mu','σ':'\\sigma','ω':'\\omega','∞':'\\infty','∫':'\\int','∮':'\\oint','∑':'\\sum','∏':'\\prod'};
function tex(ast){
 if(ast.text)return symbols[ast.text]?symbols[ast.text]+' ':ast.text;
 const unwrap=node=>node.type==='row'&&node.children.length===3&&node.children[0].text==='('&&node.children[2].text===')'?node.children[1]:node;
 const items=ast.children.map(node=>tex(['frac','sqrt','root'].includes(ast.type)?unwrap(node):node));
 return ast.type==='frac'?'\\frac{'+items[0]+'}{'+items[1]+'}':ast.type==='power'?items[0]+'^{'+items[1]+'}':ast.type==='subscript'?items[0]+'_{'+items[1]+'}':ast.type==='sqrt'?'\\sqrt{'+items[0]+'}':ast.type==='root'?'\\sqrt['+items[1]+']{'+items[0]+'}':items.join('');
}
function normalize(source){return source.replace(/−/g,'-').replace(/×/g,'\\times ').replace(/÷/g,'\\div ').replace(/[π∞∫∮∑∏]/g,c=>symbols[c]+' ');}
function pieces(text){
 const result=[],pattern=/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|[A-Za-z0-9α-ωΑ-Ωπ∞∫∮∑∏√∛∜(\\][A-Za-z0-9α-ωΑ-Ωπ∞∫∮∑∏√∛∜()[\]+\-*/^_{}=.,\\]*/g;
 let at=0;
 for(const match of String(text).matchAll(pattern)){result.push({text:String(text).slice(at,match.index)});const explicit=match.slice(1).find(value=>value!==undefined);const source=explicit===undefined?match[0]:explicit;const ast=parse(source);const candidate=explicit!==undefined||/\^|_|\/|\\|[√∛∜∫∮∑∏]/.test(source);
  const usable=candidate&&!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(source)&&source.length<=2048;
  result.push(usable?{text:match[0],source,ast,tex:ast?tex(ast):normalize(source)}:{text:match[0]});at=match.index+match[0].length;
 }result.push({text:String(text).slice(at)});return result;
}
function format(text){
 const fragment=document.createDocumentFragment();let formatted=false,needsEngine=false;
 for(const part of pieces(text)){
  if(part.source){needsEngine=true;
   if(root.katex){try{const span=document.createElement('span');root.katex.render(part.tex,span,{output:'mathml',displayMode:true,throwOnError:true,trust:false,strict:'ignore',maxExpand:100,maxSize:20});fragment.append(span);formatted=true;continue;}catch{/* Preserve unsupported notation. */}}
   if(part.ast){const math=document.createElementNS('http://www.w3.org/1998/Math/MathML','math');math.setAttribute('display','inline');math.setAttribute('displaystyle','true');math.setAttribute('alttext',part.source);math.append(draw(part.ast));fragment.append(math);formatted=true;continue;}
  }fragment.append(document.createTextNode(part.text));
 }return {fragment,formatted,needsEngine};
}
let task;
function load(){if(root.katex)return Promise.resolve();if(task)return task;task=new Promise((resolve,reject)=>{const script=document.createElement('script'),url=new URL('vendor/katex/katex.min.js',document.baseURI);url.searchParams.set('v',document.querySelector('meta[name="application-version"]')?.content||'0.16.22');script.src=url.href;script.onload=()=>root.katex?resolve():reject(Error('math'));script.onerror=()=>{script.remove();task=null;reject(Error('math'));};document.head.append(script);});return task;}
function draw(ast){const tag={number:'mn',symbol:'mi',op:'mo',row:'mrow',frac:'mfrac',power:'msup',subscript:'msub',sqrt:'msqrt',root:'mroot'}[ast.type],node=document.createElementNS('http://www.w3.org/1998/Math/MathML',tag);if(ast.text)node.textContent=ast.text;else ast.children.forEach(child=>node.append(draw(child)));return node;}
root.WorkbookMath={parse,format,load,pieces,tex};if(typeof module!=='undefined')module.exports={parse,pieces,tex};
})(typeof window==='undefined'?globalThis:window);

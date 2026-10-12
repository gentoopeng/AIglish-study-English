// Render a bounded subset of Markdown as DOM; AI output never becomes HTML.
(function(root){
'use strict';
function render(target,source){
 source=String(source||'').slice(0,30000).replace(/\r\n?/g,'\n');target.replaceChildren();
 function inline(node,text,depth=0){
  if(depth>8){node.append(document.createTextNode(text));return;}
  // Math is recognized before emphasis so underscores inside LaTeX stay intact.
  const pattern=/\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\*\*([^\n]+?)\*\*|__([^\n]+?)__|`([^`\n]+)`/g;let at=0;
  const plain=text=>node.append(root.WorkbookMath?root.WorkbookMath.format(text).fragment:document.createTextNode(text));
  for(const match of text.matchAll(pattern)){plain(text.slice(at,match.index));if(match[1]!==undefined||match[2]!==undefined){const strong=document.createElement('strong');inline(strong,match[1]??match[2],depth+1);node.append(strong);}else if(match[3]!==undefined){const code=document.createElement('code');code.textContent=match[3];node.append(code);}else plain(match[0]);at=match.index+match[0].length;}plain(text.slice(at));
 }
 const lines=source.split('\n');let paragraph=null,list=null,listKind='';
 function reset(){paragraph=null;list=null;listKind='';}
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim()){reset();continue;}
  if(/^\s*```/.test(line)){reset();const kind=line.trim().slice(3),parts=[];while(++i<lines.length&&!/^\s*```/.test(lines[i]))parts.push(lines[i]);const node=document.createElement(/^(math|latex|tex)$/.test(kind)?'div':'pre');node.className='workbook-explanation-equation';if(node.tagName==='PRE')node.textContent=parts.join('\n');else inline(node,'$$'+parts.join('\n')+'$$');target.append(node);continue;}
  if(/^\s*(\$\$|\\\[)/.test(line)){reset();const closing=line.trim().startsWith('$$')?'$$':'\\]',parts=[line];if(!line.trim().endsWith(closing)||line.trim()===closing){while(++i<lines.length){parts.push(lines[i]);if(lines[i].trim().endsWith(closing))break;}}const node=document.createElement('div');node.className='workbook-explanation-equation';inline(node,parts.join('\n'));target.append(node);continue;}
  const heading=line.match(/^\s*#{1,6}\s+(.+)$/);if(heading){reset();const node=document.createElement('h3');inline(node,heading[1]);target.append(node);continue;}
  const item=line.match(/^\s*(?:([-*•])\s+|(\d+)[.)]\s+)(.+)$/);
  if(item){paragraph=null;const kind=item[2]?'ol':'ul';if(!list||listKind!==kind){list=document.createElement(kind);if(kind==='ol')list.start=Number(item[2]);target.append(list);listKind=kind;}const node=document.createElement('li');inline(node,item[3]);list.append(node);continue;}
  if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){reset();target.append(document.createElement('hr'));continue;}
  list=null;listKind='';if(!paragraph){paragraph=document.createElement('p');target.append(paragraph);}else paragraph.append(document.createElement('br'));inline(paragraph,line.trim());
 }
}
root.WorkbookExplanation={render};
})(typeof window==='undefined'?globalThis:window);

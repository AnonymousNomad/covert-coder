import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source=await readFile(new URL('../../browser/src/panels/studio.ts',import.meta.url),'utf8');
const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.textContent='';this.className='';this.parentElement=null;}
 append(...nodes){for(const node of nodes)this.appendChild(node);}
 appendChild(node){node.remove?.();this.children.push(node);node.parentElement=this;return node;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}}
}
const all=root=>[root,...root.children.flatMap(all)];
const textOf=root=>all(root).map(node=>node.textContent).join(' ');

test('Studio foundation exposes production workflow without inventing generation authority',()=>{
 const parent=new Element('section'),document={createElement:tag=>new Element(tag)},exports={};
 vm.runInNewContext(script,{exports,document});
 const handle=exports.createStudioPanel(parent);const text=textOf(parent);
 for(const label of ['COVERT STUDIO','IDEA','SCRIPT','BIBLE','SHOT GRAPH','GENERATE','REVIEW','ASSEMBLE','EXPORT'])assert.match(text,new RegExp(label));
 assert.match(text,/STORY GATED/);assert.match(text,/GENERATORS GATED/);assert.match(text,/EXPORT GATED/);
 assert.match(text,/does not generate media by itself/);assert.match(text,/No provider call, generation, spend, file mutation, render, upload or publication action/);
 assert.equal(all(parent).some(node=>node.tag==='button'),false);
 handle.dispose();assert.equal(parent.children.length,0);
});

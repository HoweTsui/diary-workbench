import test from 'node:test';
import assert from 'node:assert/strict';
const calls=[];
const ctx={scale(...args){calls.push(['scale',...args]);},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},measureText(t){return {width:t.length*40};},drawImage(...args){calls.push(['image',...args.slice(1)]);}};
globalThis.document={fonts:{load:async()=>[{}],ready:Promise.resolve()},createElement:()=>({getContext:()=>ctx})};
globalThis.Image=class{naturalWidth=900;naturalHeight=1200;async decode(){}};
const {paperCanvas,coverCanvas}=await import('./paper.js');
test('paper uses 2x backing resolution without changing layout coordinates',()=>{
 const c=paperCanvas();assert.equal(c.width,1800);assert.equal(c.height,2400);assert.deepEqual(calls.at(-1),['scale',2,2]);
});
test('cover contains whole portrait artwork without clip or stretching',async()=>{
 await coverCanvas('阿纸的日记','test.png');
 const [,x,y,w,h]=calls.at(-1);assert.equal(w/h,3/4);assert.equal(h,600);assert.equal(x+w/2,450);assert.equal(y+h/2,625);
});

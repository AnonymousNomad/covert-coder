import test from 'node:test';
import assert from 'node:assert/strict';
import { windowPixelBounds } from '../../browser/src/desktop/layout.ts';
test('a minimum-sized terminal stays inside a short work area instead of extending behind the dock', () => {
 const bounds=windowPixelBounds({x:.51,y:.69,width:.47,height:.30},{width:900,height:600},{width:460,height:240});
 assert.deepEqual(bounds,{x:440,y:360,width:460,height:240});
});
test('a small viewport caps application minima and preserves visible window controls', () => {
 const bounds=windowPixelBounds({x:.98,y:.98,width:.5,height:.5},{width:300,height:200},{width:520,height:320});
 assert.deepEqual(bounds,{x:0,y:0,width:300,height:200});
});

const assert=require('node:assert/strict');
global.J={};require('../src/08k_detail_search.js');
for(const [query,text] of [
  ['ぼかし','字ごとボケ'],['ﾌﾞﾗｰ','ピント送り'],['暈し','Blur'],
  ['回転','Spin in'],['スピン','ゆっくり回転'],['かいてん','回転ズーム'],
  ['拡大','Cinematic pushIn'],['ズーム・イン','push in'],['縮小','Shrink'],
  ['白黒','Film monochrome'],['縁取り','Outline'],['ふちどり','縁取り'],
  ['グレイスケール','grayscale'],['回転 拡大','Rotating zoomIn'],
  ['回転拡大','Spin pushIn'],['ぶらー','blur'],['ZOOM-IN','プッシュイン'],
  ['フェイド','Fade'],['ディゾルヴ','Dissolve'],['ウエーブ','Wave'],
  ['blck white','Black and white'],['','anything'],
]) assert(J.detailSearchQuery(query)(text),query+' -> '+text);
for(const [query,text] of [
  ['拡大','Shrink'],['回転 ぼかし','Spin in'],['pin','スピン'],['zzzzzz','ぼかし'],
]) assert(!J.detailSearchQuery(query)(text),query+' unexpectedly matched '+text);
console.log('Search synonym tests passed');

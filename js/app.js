"use strict";
const SYMBOLS=["🍎","🍋","🍇","🍒","🥝","🍑","🍉","🍓","🍍","🍊","🥥","🍐","🍌","🫐","🥕","🍪"];
const CFG={cols:12,rows:8,traySize:7,gap:8,layerDx:6,layerDy:5,minEasy:48,minHard:60,levelsEasy:3,levelsHard:4,densityEasy:0.72,densityHard:0.80,typesEasy:10,typesHard:12};
const elBoard=document.getElementById("board");
const elTraySlots=document.getElementById("traySlots");
const elStatus=document.getElementById("status");
const elMoves=document.getElementById("txtMoves");
const elLeft=document.getElementById("txtLeft");
const elTray=document.getElementById("txtTray");
const btnNew=document.getElementById("btnNew");
const btnUndo=document.getElementById("btnUndo");
const btnShuffle=document.getElementById("btnShuffle");
const btnDifficulty=document.getElementById("btnDifficulty");
let difficulty=1;
let tiles=[];
let tray=[];
let history=[];
let moves=0;
let isOver=false;
function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=arr[i];arr[i]=arr[j];arr[j]=t}return arr}
function deepCopy(x){if(typeof structuredClone==="function")return structuredClone(x);return JSON.parse(JSON.stringify(x))}
function computeTileSizeAndFitBoard(){
  const desiredVar=getComputedStyle(document.documentElement).getPropertyValue("--tile").trim();
  const desired=parseInt(desiredVar.replace("px",""),10);
  const desiredSize=Number.isFinite(desired)?desired:56;
  const padX=14;
  const padTop=40;
  const padBottom=14;
  const headerEl=document.querySelector(".header");
  const barEl=document.querySelector(".bar");
  const trayEl=document.querySelector(".trayPanel");
  const headerH=headerEl?headerEl.offsetHeight:0;
  const barH=barEl?barEl.offsetHeight:0;
  const trayH=trayEl?trayEl.offsetHeight:0;
  const viewportH=window.innerHeight;
  const containerPad=24;
  const availableH=Math.max(260,viewportH-headerH-barH-trayH-containerPad);
  const maxByHeight=Math.floor((availableH-padTop-padBottom-(CFG.rows-1)*CFG.gap)/CFG.rows);
  const boardW=elBoard.clientWidth;
  const maxByWidth=Math.floor((boardW-padX*2-(CFG.cols-1)*CFG.gap)/CFG.cols);
  const size=Math.max(26,Math.min(desiredSize,maxByWidth,maxByHeight));
  const requiredH=padTop+padBottom+CFG.rows*size+(CFG.rows-1)*CFG.gap;
  elBoard.style.height=requiredH+"px";
  return{size:size,padX:padX,padTop:padTop};
}
function setStatus(html){elStatus.innerHTML=html}
function updateInfo(){elMoves.textContent=String(moves);elLeft.textContent=String(tiles.length);elTray.textContent=`${tray.length}/${CFG.traySize}`}
function makeTraySlots(){elTraySlots.innerHTML="";for(let i=0;i<CFG.traySize;i++){const d=document.createElement("div");d.className="traySlot";d.textContent="";elTraySlots.appendChild(d)}}
function colorFor(symbol){const i=SYMBOLS.indexOf(symbol);const a=(i*37)%360;const b=(a+35)%360;return `linear-gradient(180deg,hsl(${a} 70% 60%),hsl(${b} 70% 45%))`}
function snapshot(){return{tiles:deepCopy(tiles),tray:deepCopy(tray),moves:moves,isOver:isOver}}
function restore(s){tiles=s.tiles;tray=s.tray;moves=s.moves;isOver=s.isOver}
function topLayerMap(){const map=new Map();for(const t of tiles){const key=`${t.x}|${t.y}`;const cur=map.get(key);if(cur==null||t.layer>cur)map.set(key,t.layer)}return map}
function isClickable(t,top){return top.get(`${t.x}|${t.y}`)===t.layer}
function renderTray(){const slots=[...elTraySlots.children];for(let i=0;i<CFG.traySize;i++)slots[i].textContent=tray[i]?tray[i].symbol:""}
function renderBoard(){
  elBoard.querySelectorAll(".tile").forEach(n=>n.remove());
  const layout=computeTileSizeAndFitBoard();
  const size=layout.size;
  const padX=layout.padX;
  const padTop=layout.padTop;
  const w=elBoard.clientWidth;
  const h=elBoard.clientHeight;
  const fieldW=CFG.cols*(size+CFG.gap)-CFG.gap;
  const fieldH=CFG.rows*(size+CFG.gap)-CFG.gap;
  const startX=Math.max(padX,Math.floor((w-fieldW)/2));
  const startY=Math.max(padTop,Math.floor((h-fieldH)/2));
  const top=topLayerMap();
  for(const t of tiles){
    const d=document.createElement("div");
    d.className="tile";
    d.dataset.id=t.id;
    d.style.width=size+"px";
    d.style.height=size+"px";
    d.style.left=`${startX+t.x*(size+CFG.gap)+t.dx}px`;
    d.style.top=`${startY+t.y*(size+CFG.gap)+t.dy}px`;
    d.style.zIndex=String(100+t.layer*100+t.y*2+t.x);
    d.style.background=colorFor(t.symbol);
    d.textContent=t.symbol;
    const shine=document.createElement("div");
    shine.className="shine";
    d.appendChild(shine);
    if(!isClickable(t,top))d.classList.add("blocked");
    d.addEventListener("click",()=>onTileClick(t.id));
    elBoard.appendChild(d);
  }
  renderTray();
  updateInfo();
}

function removeTriples(){let changed=true;while(changed){changed=false;const map=new Map();for(let i=0;i<tray.length;i++){const s=tray[i].symbol;const idxs=map.get(s)||[];idxs.push(i);map.set(s,idxs)}for(const [sym,idxs] of map.entries()){if(idxs.length>=3){const three=idxs.slice(0,3).sort((a,b)=>b-a);for(const idx of three)tray.splice(idx,1);changed=true;break}}}}
function checkEnd(){if(tiles.length===0){isOver=true;setStatus(`<span class="win">Победа!</span> Поле очищено за <b>${moves}</b> ход(ов).`);return}if(tray.length>=CFG.traySize){isOver=true;setStatus(`<span class="lose">Поражение!</span> Лоток переполнен.`);return}}
function onTileClick(id){if(isOver)return;const top=topLayerMap();const t=tiles.find(x=>x.id===id);if(!t)return;if(!isClickable(t,top))return;if(tray.length>=CFG.traySize){checkEnd();return}history.push(snapshot());tiles=tiles.filter(x=>x.id!==id);tray.push({symbol:t.symbol,id:t.id});moves++;removeTriples();renderBoard();checkEnd()}
function undo(){if(history.length===0)return;const s=history.pop();restore(s);setStatus("");renderBoard()}
function shuffleTiles(){if(isOver)return;history.push(snapshot());const sym=tiles.map(t=>t.symbol);shuffle(sym);tiles=tiles.map((t,i)=>({id:t.id,symbol:sym[i],x:t.x,y:t.y,layer:t.layer,dx:t.dx,dy:t.dy}));renderBoard()}
function toggleDifficulty(){difficulty=difficulty===1?2:1;btnDifficulty.textContent=difficulty===1?"Сложнее":"Полегче";newGame()}
function newGame(){isOver=false;setStatus("");moves=0;history=[];tray=[];const levels=difficulty===1?CFG.levelsEasy:CFG.levelsHard;const density=difficulty===1?CFG.densityEasy:CFG.densityHard;const typesCount=difficulty===1?CFG.typesEasy:CFG.typesHard;const minTiles=difficulty===1?CFG.minEasy:CFG.minHard;let positions=[];const used=new Set();for(let layer=0;layer<levels;layer++){for(let y=0;y<CFG.rows;y++){for(let x=0;x<CFG.cols;x++){if(Math.random()<density-(layer*0.12)){const key=`${x}|${y}|${layer}`;if(!used.has(key)){used.add(key);positions.push({x:x,y:y,layer:layer})}}}}}let guard=0;let addLayer=0;while(positions.length<minTiles&&guard<8000){guard++;const x=randInt(0,CFG.cols-1);const y=randInt(0,CFG.rows-1);const layer=addLayer%levels;addLayer++;const key=`${x}|${y}|${layer}`;if(!used.has(key)){used.add(key);positions.push({x:x,y:y,layer:layer})}}if(positions.length%3!==0)positions=positions.slice(0,positions.length-(positions.length%3));const available=SYMBOLS.slice(0,typesCount);let symbols=[];for(let i=0;i<positions.length/3;i++){const s=available[i%available.length];symbols.push(s,s,s)}shuffle(symbols);shuffle(positions);tiles=positions.map((p,idx)=>({id:`t${idx}`,symbol:symbols[idx],x:p.x,y:p.y,layer:p.layer,dx:p.layer*CFG.layerDx,dy:p.layer*CFG.layerDy}));renderBoard();checkEnd()}
btnNew.addEventListener("click",()=>newGame());
btnUndo.addEventListener("click",()=>undo());
btnShuffle.addEventListener("click",()=>shuffleTiles());
btnDifficulty.addEventListener("click",()=>toggleDifficulty());
window.addEventListener("resize",()=>renderBoard());
(function init(){makeTraySlots();newGame()})();
window.addEventListener("resize",()=>renderBoard());
window.addEventListener("orientationchange",()=>setTimeout(()=>renderBoard(),50));


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
let inputLocked=false;
let layoutKey="";
function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=arr[i];arr[i]=arr[j];arr[j]=t}return arr}
function deepCopy(x){if(typeof structuredClone==="function")return structuredClone(x);return JSON.parse(JSON.stringify(x))}
function setStatus(html){elStatus.innerHTML=html}
function updateInfo(){elMoves.textContent=String(moves);elLeft.textContent=String(tiles.length);elTray.textContent=`${tray.length}/${CFG.traySize}`}
function makeTraySlots(){elTraySlots.innerHTML="";for(let i=0;i<CFG.traySize;i++){const d=document.createElement("div");d.className="traySlot";d.textContent="";elTraySlots.appendChild(d)}}
function snapshot(){return{tiles:deepCopy(tiles),tray:deepCopy(tray),moves:moves,isOver:isOver}}
function restore(s){tiles=s.tiles;tray=s.tray;moves=s.moves;isOver=s.isOver}
function setCssVar(name,value){document.documentElement.style.setProperty(name,value)}
function isMobile(){return window.matchMedia("(max-width:520px)").matches}
function isTiny(){return window.matchMedia("(max-width:380px)").matches}
function effectiveCfg(){
  const mobile=isMobile();
  const tiny=isTiny();
  let cols=CFG.cols;
  let rows=CFG.rows;
  let gap=CFG.gap;
  let layerDx=CFG.layerDx;
  let layerDy=CFG.layerDy;
  let levels=difficulty===1?CFG.levelsEasy:CFG.levelsHard;
  let density=difficulty===1?CFG.densityEasy:CFG.densityHard;
  let typesCount=difficulty===1?CFG.typesEasy:CFG.typesHard;
  let minTiles=difficulty===1?CFG.minEasy:CFG.minHard;
  if(mobile){cols=9;rows=7;layerDx=5;layerDy=4;levels=Math.min(levels,3);density=Math.min(density,0.72);minTiles=Math.min(minTiles,66);typesCount=Math.min(typesCount,10)}
  if(tiny){cols=8;rows=7;layerDx=4;layerDy=3;levels=Math.min(levels,3);density=Math.min(density,0.70);minTiles=Math.min(minTiles,60);typesCount=Math.min(typesCount,9)}
  return{cols:cols,rows:rows,gap:gap,layerDx:layerDx,layerDy:layerDy,levels:levels,density:density,typesCount:typesCount,minTiles:minTiles}
}
function currentLayoutKey(){
  const c=effectiveCfg();
  return `${c.cols}x${c.rows}|L${c.levels}|D${difficulty}|M${isMobile()?1:0}|T${isTiny()?1:0}`;
}
function topLayerMap(){const map=new Map();for(const t of tiles){const key=`${t.x}|${t.y}`;const cur=map.get(key);if(cur==null||t.layer>cur)map.set(key,t.layer)}return map}
function isClickable(t,top){return top.get(`${t.x}|${t.y}`)===t.layer}
function renderTray(){const slots=[...elTraySlots.children];for(let i=0;i<CFG.traySize;i++)slots[i].textContent=tray[i]?tray[i].symbol:""}
function updateFixedTraySpace(trayHeight){
  const mobile=isMobile();
  const extra=mobile?32:0;
  const space=mobile?Math.ceil(trayHeight+extra):0;
  setCssVar("--fixedTraySpace",space+"px");
  return space;
}
function computeTileSizeAndFitBoard(cfg){
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
  const reserved=updateFixedTraySpace(trayH);
  const viewportH=window.innerHeight;
  const containerPad=24;
  const availableH=Math.max(240,viewportH-headerH-barH-reserved-containerPad);
  const maxByHeight=Math.floor((availableH-padTop-padBottom-(cfg.rows-1)*cfg.gap)/cfg.rows);
  const boardW=elBoard.clientWidth;
  const maxByWidth=Math.floor((boardW-padX*2-(cfg.cols-1)*cfg.gap)/cfg.cols);
  const size=Math.max(30,Math.min(desiredSize,maxByWidth,maxByHeight));
  const requiredH=padTop+padBottom+cfg.rows*size+(cfg.rows-1)*cfg.gap;
  elBoard.style.height=requiredH+"px";
  return{size:size,padX:padX,padTop:padTop};
}
function renderBoard(){
  elBoard.querySelectorAll(".tile").forEach(n=>n.remove());
  const cfg=effectiveCfg();
  const layout=computeTileSizeAndFitBoard(cfg);
  const size=layout.size;
  const padX=layout.padX;
  const padTop=layout.padTop;
  const w=elBoard.clientWidth;
  const h=elBoard.clientHeight;
  const fieldW=cfg.cols*(size+cfg.gap)-cfg.gap;
  const fieldH=cfg.rows*(size+cfg.gap)-cfg.gap;
  const startX=Math.max(padX,Math.floor((w-fieldW)/2));
  const startY=Math.max(padTop,Math.floor((h-fieldH)/2));
  const top=topLayerMap();
  for(const t of tiles){
    const d=document.createElement("div");
    d.className="tile";
    d.dataset.id=t.id;
    d.style.width=size+"px";
    d.style.height=size+"px";
    d.style.left=`${startX+t.x*(size+cfg.gap)+t.dx}px`;
    d.style.top=`${startY+t.y*(size+cfg.gap)+t.dy}px`;
    d.style.zIndex=String(100+t.layer*100+t.y*2+t.x);
    const hue=(SYMBOLS.indexOf(t.symbol)*37)%360;
    const r=Math.max(10,Math.round(size*0.22));
    const pipSize=Math.max(7,Math.round(size*0.22));
    const pipOffset=Math.max(6,Math.round(size*0.18));
    const iconSize=Math.max(16,Math.round(size*0.78));
    d.style.setProperty("--hue",String(hue));
    d.style.setProperty("--r",r+"px");
    d.style.setProperty("--pipSize",pipSize+"px");
    d.style.setProperty("--pipOffset",pipOffset+"px");
    d.style.setProperty("--iconSize",iconSize+"px");
    const pip=document.createElement("span");
    pip.className="tilePip";
    const icon=document.createElement("span");
    icon.className="tileIcon";
    icon.textContent=t.symbol;
    d.appendChild(pip);
    d.appendChild(icon);
    if(!isClickable(t,top))d.classList.add("blocked");
    d.addEventListener("click",()=>onTileClick(t.id));
    elBoard.appendChild(d);
  }
  renderTray();
  updateInfo();
}
function removeTriples(){
  let changed=true;
  while(changed){
    changed=false;
    const map=new Map();
    for(let i=0;i<tray.length;i++){
      const s=tray[i].symbol;
      const idxs=map.get(s)||[];
      idxs.push(i);
      map.set(s,idxs);
    }
    for(const [sym,idxs] of map.entries()){
      if(idxs.length>=3){
        const three=idxs.slice(0,3).sort((a,b)=>b-a);
        for(const idx of three)tray.splice(idx,1);
        changed=true;
        break;
      }
    }
  }
}
function checkEnd(){
  if(tiles.length===0){isOver=true;setStatus(`<span class="win">Победа!</span> Поле очищено за <b>${moves}</b> ход(ов).`);return}
  if(tray.length>=CFG.traySize){isOver=true;setStatus(`<span class="lose">Поражение!</span> Лоток переполнен.`);return}
}
function animateFlyToTray(tileId,targetIndex){
  const tileEl=elBoard.querySelector(`.tile[data-id="${tileId}"]`);
  const slotEl=elTraySlots.children[targetIndex]||elTraySlots.children[CFG.traySize-1];
  if(!tileEl||!slotEl)return Promise.resolve();
  const from=tileEl.getBoundingClientRect();
  const to=slotEl.getBoundingClientRect();
  const ghost=tileEl.cloneNode(true);
  ghost.classList.remove("blocked");
  ghost.style.position="fixed";
  ghost.style.left=from.left+"px";
  ghost.style.top=from.top+"px";
  ghost.style.width=from.width+"px";
  ghost.style.height=from.height+"px";
  ghost.style.margin="0";
  ghost.style.zIndex="9999";
  ghost.style.pointerEvents="none";
  document.body.appendChild(ghost);
  tileEl.style.visibility="hidden";
  const dx=(to.left+to.width/2)-(from.left+from.width/2);
  const dy=(to.top+to.height/2)-(from.top+from.height/2);
  const anim=ghost.animate([{transform:"translate(0px,0px) scale(1)",opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.85)`,opacity:.95}],{duration:220,easing:"cubic-bezier(.2,.8,.2,1)",fill:"forwards"});
  return anim.finished.catch(()=>{}).finally(()=>{ghost.remove();tileEl.style.visibility=""});
}
async function onTileClick(id){
  if(isOver||inputLocked)return;
  const top=topLayerMap();
  const t=tiles.find(x=>x.id===id);
  if(!t)return;
  if(!isClickable(t,top))return;
  if(tray.length>=CFG.traySize){checkEnd();return}
  inputLocked=true;
  const targetIndex=tray.length;
  await animateFlyToTray(id,targetIndex);
  history.push(snapshot());
  tiles=tiles.filter(x=>x.id!==id);
  tray.push({symbol:t.symbol,id:t.id});
  moves++;
  removeTriples();
  renderBoard();
  checkEnd();
  inputLocked=false;
}
function undo(){if(history.length===0)return;const s=history.pop();restore(s);setStatus("");renderBoard()}
function shuffleTiles(){if(isOver)return;history.push(snapshot());const sym=tiles.map(t=>t.symbol);shuffle(sym);tiles=tiles.map((t,i)=>({id:t.id,symbol:sym[i],x:t.x,y:t.y,layer:t.layer,dx:t.dx,dy:t.dy}));renderBoard()}
function toggleDifficulty(){difficulty=difficulty===1?2:1;btnDifficulty.textContent=difficulty===1?"Сложнее":"Полегче";newGame()}
function newGame(){
  isOver=false;
  setStatus("");
  moves=0;
  history=[];
  tray=[];
  const cfg=effectiveCfg();
  let positions=[];
  const used=new Set();
  for(let layer=0;layer<cfg.levels;layer++){
    for(let y=0;y<cfg.rows;y++){
      for(let x=0;x<cfg.cols;x++){
        if(Math.random()<cfg.density-(layer*0.12)){
          const key=`${x}|${y}|${layer}`;
          if(!used.has(key)){used.add(key);positions.push({x:x,y:y,layer:layer})}
        }
      }
    }
  }
  let guard=0;
  let addLayer=0;
  while(positions.length<cfg.minTiles&&guard<8000){
    guard++;
    const x=randInt(0,cfg.cols-1);
    const y=randInt(0,cfg.rows-1);
    const layer=addLayer%cfg.levels;
    addLayer++;
    const key=`${x}|${y}|${layer}`;
    if(!used.has(key)){used.add(key);positions.push({x:x,y:y,layer:layer})}
  }
  if(positions.length%3!==0)positions=positions.slice(0,positions.length-(positions.length%3));
  const available=SYMBOLS.slice(0,cfg.typesCount);
  let symbols=[];
  for(let i=0;i<positions.length/3;i++){
    const s=available[i%available.length];
    symbols.push(s,s,s);
  }
  shuffle(symbols);
  shuffle(positions);
  tiles=positions.map((p,idx)=>({id:`t${idx}`,symbol:symbols[idx],x:p.x,y:p.y,layer:p.layer,dx:p.layer*cfg.layerDx,dy:p.layer*cfg.layerDy}));
  layoutKey=currentLayoutKey();
  renderBoard();
  checkEnd();
}
function handleResize(){
  const key=currentLayoutKey();
  if(key!==layoutKey){newGame();return}
  renderBoard();
}
btnNew.addEventListener("click",()=>newGame());
btnUndo.addEventListener("click",()=>undo());
btnShuffle.addEventListener("click",()=>shuffleTiles());
btnDifficulty.addEventListener("click",()=>toggleDifficulty());
window.addEventListener("resize",()=>handleResize());
window.addEventListener("orientationchange",()=>setTimeout(()=>handleResize(),80));
(function init(){makeTraySlots();newGame()})();
